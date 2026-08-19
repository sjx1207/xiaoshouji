/* ================================================================
   diary.js — Luna 日记 App
   Part A：状态栏时间 / 电量同步（一比一复刻 index.html / secret.js 的逻辑，
           保证从主界面跳转进来后，状态栏观感与系统一致，不会"看起来像另一个App"）
   Part B：底部导航栏交互 —— 珍珠指示器滑动、涟漪反馈、页面切换动画
================================================================ */

(function(){
  'use strict';

  /* ============================================================
     Part A —— 状态栏同步
  ============================================================ */

  /* ---- 实时时间（与主界面 luna_tz 设置保持一致）----
     同时同步主状态栏与详情页专属状态栏，两者数值必须一致，
     否则从日记流跳入详情页时会有"观感断裂"的问题。 */
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
    ['statusTime', 'detailStatusTime', 'cdhStatusTime'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.textContent = timeStr;
    });
  }

  /* ---- 电量（读取主界面设置的 luna_battery，而非设备真实电量，保持数值一致）---- */
  function updateBattery(){
    var pct = parseInt(localStorage.getItem('luna_battery') || '76', 10);
    if (isNaN(pct)) pct = 76;
    var grad = pct <= 20
      ? 'linear-gradient(90deg, #f87171, #ef4444)'
      : 'linear-gradient(90deg, #6ee7b7, #34d399)';
    [['batPct','batInner'], ['detailBatPct','detailBatInner'], ['cdhBatPct','cdhBatInner']].forEach(function(pair){
      var pctEl = document.getElementById(pair[0]);
      var innerEl = document.getElementById(pair[1]);
      if (pctEl) pctEl.textContent = pct;
      if (innerEl){
        innerEl.style.width = pct + '%';
        innerEl.style.background = grad;
      }
    });
  }

  /* ---- 灵动岛（与主界面 luna_island_enabled / luna_island_style 保持一致）----
     同时应用到主状态栏与详情页状态栏两处灵动岛占位元素。 */
  function applyIsland(){
    var enabled = localStorage.getItem('luna_island_enabled') === 'true';
    var style = localStorage.getItem('luna_island_style') || 'minimal';
    var els = ['statusIsland', 'detailStatusIsland', 'cdhStatusIsland']
      .map(function(id){ return document.getElementById(id); })
      .filter(Boolean);
    if (!els.length) return;
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
    els.forEach(function(el){ el.innerHTML = html; });
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

  /* ---- 字体同步（与主界面自定义字体保持一致）---- */
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
      tag.textContent = '.diary-app *{ ' + familyRule + ' }';
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

  /* ---- 跨标签页实时同步 ---- */
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
     Part B —— 底部导航栏交互
  ============================================================ */

  document.addEventListener('DOMContentLoaded', function(){

    var TAB_ORDER = ['mine', 'char', 'private'];
    var TAB_TITLES = {
      mine: '我的日记',
      char: 'Char 日记',
      private: '私密'
    };

    var tabs = Array.prototype.slice.call(document.querySelectorAll('.diary-tab'));
    var pearl = document.getElementById('navPearl');
    var navEl = document.getElementById('diaryNav');
    var titleEl = document.getElementById('diaryTitle');
    var headerCenterEl = document.getElementById('diaryHeaderCenter');
    var pages = Array.prototype.slice.call(document.querySelectorAll('.diary-page'));

    /* 珍珠指示器的位置/宽度直接读取目标 tab 的真实几何信息（offsetLeft / offsetWidth），
       而不是用百分比公式估算 —— 这样无论 nav 的左右 padding、tab 间距如何，
       珍珠永远像素级贴合被选中的 tab，不会出现"Char日记/私密"选中框跑偏的问题。
       内边距做一点内收（inset），让珍珠比 tab 本身略窄，视觉上更精致。 */
    function movePearlTo(tabEl){
      if (!pearl || !tabEl || !navEl) return;
      var inset = 4; /* 珍珠比 tab 左右各内收 4px */
      var left = tabEl.offsetLeft + inset;
      var width = tabEl.offsetWidth - inset * 2;
      pearl.style.left = left + 'px';
      pearl.style.width = width + 'px';
      pearl.style.transform = 'translateX(0)';
    }

    function activateTab(tabName, opts){
      opts = opts || {};
      var idx = TAB_ORDER.indexOf(tabName);
      if (idx === -1) return;

      var targetTab = tabs.filter(function(t){ return t.dataset.tab === tabName; })[0];

      /* 珍珠指示器滑动到目标 tab 的真实位置 */
      movePearlTo(targetTab);

      /* tab 激活态切换 */
      tabs.forEach(function(t){
        t.classList.toggle('active', t.dataset.tab === tabName);
      });

      /* 页面切换（华丽的模糊过渡） */
      pages.forEach(function(p){
        p.classList.toggle('active', p.dataset.page === tabName);
      });

      /* 标题文字逐字过渡 */
      if (titleEl && !opts.skipTitleAnim){
        titleEl.classList.add('switching');
        setTimeout(function(){
          titleEl.textContent = TAB_TITLES[tabName];
          titleEl.classList.remove('switching');
        }, 180);
      } else if (titleEl){
        titleEl.textContent = TAB_TITLES[tabName];
      }

      /* 页头右侧按钮组（返回 / 写日记）仅属于"我的日记"页——
         切到 Char日记 / 私密 时整体收起，让出空间给各页各自的顶部语言，
         避免"返回按钮"这种仅"我的日记"专属的操作出现在别的页面语境里 */
      var scopedEls = document.querySelectorAll('[data-page-scope="mine"]');
      scopedEls.forEach(function(el){
        el.classList.toggle('scope-hidden', tabName !== 'mine');
      });
    }

    tabs.forEach(function(tab){
      tab.addEventListener('click', function(){
        var tabName = tab.dataset.tab;
        if (tab.classList.contains('active')) return;

        /* 涟漪反馈 */
        var ripple = tab.querySelector('.diary-tab-ripple');
        if (ripple){
          ripple.classList.remove('firing');
          void ripple.offsetWidth; /* 强制重排以重启动画 */
          ripple.classList.add('firing');
        }

        /* 轻触觉反馈（若设备支持） */
        if (window.navigator && window.navigator.vibrate){
          try{ window.navigator.vibrate(6); }catch(e){}
        }

        activateTab(tabName);
      });
    });

    /* 初始态 —— 用双重 requestAnimationFrame 确保字体/布局已经完成一次
       真实渲染后再测量位置，避免页面刚加载时字体尚未换入、
       导致 tab 宽度还是"回退字体"的临时值，珍珠框首次定位就偏了。 */
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        activateTab('mine', { skipTitleAnim: true });
      });
    });

    /* 窗口尺寸变化（设备旋转 / 键盘弹出等）时，重新贴合当前激活 tab */
    window.addEventListener('resize', function(){
      var current = tabs.filter(function(t){ return t.classList.contains('active'); })[0];
      if (current) movePearlTo(current);
    });

    /* 字体异步加载完成后（自定义字体等）也重新校准一次位置 */
    if (document.fonts && document.fonts.ready){
      document.fonts.ready.then(function(){
        var current = tabs.filter(function(t){ return t.classList.contains('active'); })[0];
        if (current) movePearlTo(current);
      });
    }
  });

  /* ============================================================
     Part C —— 写日记 Composer + 我的日记 · 日记流
  ============================================================ */

  var STORAGE_KEY = 'luna_diary_entries_mine';

  var MOOD_META = {
    calm:   { label: '平静', icon: '<svg viewBox="0 0 24 24"><path d="M4 14c2-2.5 4-2.5 6 0s4 2.5 6 0 4-2.5 6 0" /></svg>' },
    joy:    { label: '欢喜', icon: '<svg viewBox="0 0 24 24"><path d="M5 13c1.5 3.2 4.2 5 7 5s5.5-1.8 7-5" /><circle cx="8.5" cy="9" r="0.9" fill="currentColor" stroke="none"/><circle cx="15.5" cy="9" r="0.9" fill="currentColor" stroke="none"/></svg>' },
    tender: { label: '柔软', icon: '<svg viewBox="0 0 24 24"><path d="M12 19c-.3 0-.6-.1-.8-.3C7.8 15.9 5 13.4 5 10.3 5 8 6.8 6.2 9 6.2c1.1 0 2.2.5 3 1.4.8-.9 1.9-1.4 3-1.4 2.2 0 4 1.8 4 4.1 0 3.1-2.8 5.6-6.2 8.4-.2.2-.5.3-.8.3Z" /></svg>' },
    blue:   { label: '低落', icon: '<svg viewBox="0 0 24 24"><path d="M12 4c-4 4-7 7.4-7 10.6A7 7 0 0 0 12 21a7 7 0 0 0 7-6.4C19 11.4 16 8 12 4Z" /></svg>' },
    storm:  { label: '翻涌', icon: '<svg viewBox="0 0 24 24"><path d="M7 9a5 5 0 0 1 9.6-1.8A4 4 0 0 1 17 15H7.5a3.5 3.5 0 0 1-.5-6.9Z" /></svg>' }
  };

  var WEEKDAYS_CN = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
  var MONTHS_EN = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];

  var WEATHER_META = {
    sunny:  { label: '晴朗', icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M18.4 18.4l-2.1-2.1M7.7 7.7 5.6 5.6" stroke-linecap="round"/></svg>' },
    cloudy: { label: '多云', icon: '<svg viewBox="0 0 24 24"><path d="M7 15a4 4 0 0 1 .7-7.9A5 5 0 0 1 17.4 9 3.6 3.6 0 0 1 17 16H7Z"/></svg>' },
    rainy:  { label: '有雨', icon: '<svg viewBox="0 0 24 24"><path d="M6.5 13a4 4 0 0 1 .7-7.9A5 5 0 0 1 16.9 7 3.6 3.6 0 0 1 16.5 14H6.5Z"/><path d="M8 17.5 7 20M12 17.5l-1 2.5M16 17.5l-1 2.5" stroke-linecap="round"/></svg>' },
    night:  { label: '夜晚', icon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/></svg>' },
    snow:   { label: '落雪', icon: '<svg viewBox="0 0 24 24"><path d="M12 2v20M4.5 7l15 10M19.5 7l-15 10" stroke-linecap="round"/></svg>' }
  };

  /* 校验单条日记的基本结构是否完整可用 */
  function isValidEntry(e){
    return !!(e && typeof e === 'object' && typeof e.id === 'string' && typeof e.ts === 'number');
  }

  /* 数据整体损坏时，尝试从原始字符串里逐条抢救仍然合法的日记对象，
     而不是直接丢弃全部内容。抢救成功后会把抢回来的条目自动重新保存。 */
  function recoverEntriesFromRaw(raw){
    var recovered = [];
    if (typeof raw !== 'string' || !raw) return recovered;
    var objRe = /\{(?:[^{}]|\{[^{}]*\})*\}/g;
    var match;
    while ((match = objRe.exec(raw)) !== null){
      try{
        var obj = JSON.parse(match[0]);
        if (isValidEntry(obj)) recovered.push(obj);
      }catch(e2){ /* 这一段确实救不回来，跳过 */ }
    }
    /* 按 id 去重，避免正则重叠匹配产生重复条目 */
    var seen = {};
    var deduped = [];
    for (var i = 0; i < recovered.length; i++){
      var it = recovered[i];
      if (!seen[it.id]){ seen[it.id] = true; deduped.push(it); }
    }
    /* 按时间排序，保持和原有顺序一致 */
    deduped.sort(function(a, b){ return (a.ts || 0) - (b.ts || 0); });
    return deduped;
  }

  function loadEntries(){
    var raw = null;
    try{
      raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
      /* 解析出来了但不是数组（比如变成了 {} 或字符串），当作损坏处理 */
      throw new Error('not an array');
    }catch(e){
      /* JSON 损坏：先备份原始坏数据，方便万一需要人工找回，再尝试逐条抢救 */
      if (raw){
        try{ localStorage.setItem(STORAGE_KEY + '_corrupted_backup', raw); }catch(e3){}
      }
      var recovered = recoverEntriesFromRaw(raw);
      if (recovered.length){
        saveEntries(recovered);
      }
      return recovered;
    }
  }

  function saveEntries(list){
    if (!Array.isArray(list)) return false;
    var json;
    try{
      json = JSON.stringify(list);
    }catch(e){
      console.error('[diary] 日记数据序列化失败，未保存：', e);
      return false;
    }
    try{
      localStorage.setItem(STORAGE_KEY, json);
    }catch(e){
      /* 常见原因：超出 localStorage 容量配额（通常约 5MB），多半是照片太多/太大 */
      console.error('[diary] 保存日记失败（可能是存储空间已满，照片太多或太大）：', e);
      return false;
    }
    /* 写入后立刻读回校验，确保这次真的存对了，不是"看起来成功实际写坏" */
    try{
      var check = localStorage.getItem(STORAGE_KEY);
      if (check !== json){
        console.error('[diary] 保存后校验不一致，数据可能未完整写入');
        return false;
      }
    }catch(e2){
      return false;
    }
    return true;
  }

  function pad2(n){ return String(n).padStart(2, '0'); }

  function fmtEntryTime(ts){
    var d = new Date(ts);
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function dayLabel(ts){
    var now = new Date();
    var d = new Date(ts);
    var sameDay = now.toDateString() === d.toDateString();
    var yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    var isYesterday = yesterday.toDateString() === d.toDateString();
    if (sameDay) return '今天';
    if (isYesterday) return '昨天';
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  function escapeHtml(str){
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderFeed(){
    var emptyState = document.getElementById('mineEmptyState');
    var feed = document.getElementById('mineFeed');
    var inner = document.getElementById('mineFeedInner');
    if (!emptyState || !feed || !inner) return;

    var entries = loadEntries();

    if (entries.length === 0){
      emptyState.hidden = false;
      feed.hidden = true;
      inner.innerHTML = '';
      return;
    }

    emptyState.hidden = true;
    feed.hidden = false;

    /* 最新的在最上面 */
    var sorted = entries.slice().sort(function(a, b){ return b.ts - a.ts; });

    var html = '';
    var lastGroup = null;

    sorted.forEach(function(entry, idx){
      var group = dayLabel(entry.ts);
      if (group !== lastGroup){
        html += '<div class="feed-group-label"><span>' + escapeHtml(group) + '</span></div>';
        lastGroup = group;
      }

      var d = new Date(entry.ts);
      var mood = MOOD_META[entry.mood] || MOOD_META.calm;
      var bodyEsc = escapeHtml(entry.body || '');
      var titleEsc = escapeHtml(entry.title || '无题');
      var charCount = (entry.body || '').length;
      var needsExpand = charCount > 160 || (entry.body || '').split('\n').length > 5;

      /* 天气 / 位置 元信息条 */
      var metaHtml = '';
      if (entry.weather && WEATHER_META[entry.weather]){
        metaHtml += '<span class="entry-meta-chip">' + WEATHER_META[entry.weather].icon + '<span>' + WEATHER_META[entry.weather].label + '</span></span>';
      }
      if (entry.location){
        metaHtml += '<span class="entry-meta-chip"><svg viewBox="0 0 24 24"><path d="M12 21s-6.5-6-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2"/></svg><span>' + escapeHtml(entry.location) + '</span></span>';
      }

      /* 配图区：图片 + 视觉可见的文字描述（同时也是给 AI 读取的语义） */
      var photosHtml = '';
      if (entry.photos && entry.photos.length){
        photosHtml = '<div class="entry-photos">' + entry.photos.map(function(p){
          return '<div class="entry-photo">' +
            '<img src="' + p.dataUrl + '" alt="' + escapeHtml(p.desc || '') + '" />' +
            (p.desc ? '<div class="entry-photo-alt">' + escapeHtml(p.desc) + '</div>' : '') +
          '</div>';
        }).join('') + '</div>';
      }

      /* 标签区 */
      var tagsHtml = '';
      if (entry.tags && entry.tags.length){
        tagsHtml = '<div class="entry-tags">' + entry.tags.map(function(t){
          return '<span class="entry-tag">' + escapeHtml(t) + '</span>';
        }).join('') + '</div>';
      }

      html +=
        '<div class="diary-entry" data-id="' + entry.id + '" style="animation-delay:' + Math.min(idx * 0.05, 0.4) + 's">' +
          '<div class="entry-mood" data-mood="' + entry.mood + '">' + mood.icon + '<span>' + mood.label + '</span></div>' +
          '<div class="entry-top">' +
            '<div class="entry-date">' +
              '<span class="entry-date-day">' + pad2(d.getDate()) + '</span>' +
              '<span class="entry-date-sub">' + MONTHS_EN[d.getMonth()].slice(0,3) + '</span>' +
            '</div>' +
          '</div>' +
          (metaHtml ? '<div class="entry-meta-row">' + metaHtml + '</div>' : '') +
          '<div class="entry-title">' + titleEsc + '</div>' +
          '<div class="entry-body-wrap">' +
            '<div class="entry-body">' + bodyEsc + '</div>' +
            (needsExpand ? '<button class="entry-expand" type="button"><span>展开全文</span><svg viewBox="0 0 10 6" fill="none"><path d="M1 1 L5 5 L9 1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' : '') +
          '</div>' +
          photosHtml +
          tagsHtml +
          '<div class="entry-foot">' +
            '<span class="entry-foot-mark"></span>' +
            '<span class="entry-foot-text">' + fmtEntryTime(entry.ts) + '　·　' + charCount + ' 字' + (entry.photos && entry.photos.length ? '　·　' + entry.photos.length + ' 图' : '') + '</span>' +
          '</div>' +
        '</div>';
    });

    inner.innerHTML = html;

    /* 展开全文交互（阻止冒泡，避免同时触发下方的"点卡片进详情页"） */
    inner.querySelectorAll('.entry-expand').forEach(function(btn){
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        var card = btn.closest('.diary-entry');
        var expanded = card.classList.toggle('expanded');
        btn.querySelector('span').textContent = expanded ? '收起' : '展开全文';
      });
    });

    /* 点击整张日记卡片 → 打开详情页 */
    inner.querySelectorAll('.diary-entry').forEach(function(card){
      card.addEventListener('click', function(){
        if (window.navigator && window.navigator.vibrate){
          try{ window.navigator.vibrate(5); }catch(e){}
        }
        openDetailPage(card.dataset.id);
      });
    });
  }

  /* ---- Composer 状态与交互 ---- */
  document.addEventListener('DOMContentLoaded', function(){

    var backBtn = document.getElementById('diaryBackBtn');
    var writeBtn = document.getElementById('diaryWriteBtn');
    var veil = document.getElementById('composerVeil');
    var composer = document.getElementById('composer');
    var cancelBtn = document.getElementById('composerCancel');
    var publishBtn = document.getElementById('composerPublish');
    var titleInput = document.getElementById('composerTitleInput');
    var textInput = document.getElementById('composerTextInput');
    var cfCountNum = document.getElementById('cfCountNum');
    var cfDraftHint = document.getElementById('cfDraftHint');
    var moodRow = document.getElementById('moodRow');
    var cdsMonth = document.getElementById('cdsMonth');
    var cdsWeek = document.getElementById('cdsWeek');
    var stamp = document.getElementById('publishStamp');

    var weatherTagBtn = document.getElementById('weatherTagBtn');
    var weatherTagIcon = document.getElementById('weatherTagIcon');
    var weatherTagText = document.getElementById('weatherTagText');
    var weatherPicker = document.getElementById('weatherPicker');
    var locationTagBtn = document.getElementById('locationTagBtn');
    var locationTagText = document.getElementById('locationTagText');

    var photoSlots = document.getElementById('photoSlots');
    var photoAddBtn = document.getElementById('photoAddBtn');
    var photoFileInput = document.getElementById('photoFileInput');

    var tagInput = document.getElementById('tagInput');
    var tagList = document.getElementById('tagList');

    var photoDescVeil = document.getElementById('photoDescVeil');
    var photoDescModal = document.getElementById('photoDescModal');
    var pdmPreview = document.getElementById('pdmPreview');
    var pdmTextarea = document.getElementById('pdmTextarea');
    var pdmCountNum = document.getElementById('pdmCountNum');
    var pdmCancelBtn = document.getElementById('pdmCancelBtn');
    var pdmConfirmBtn = document.getElementById('pdmConfirmBtn');

    var selectedMood = 'calm';
    var selectedWeather = '';
    var locationOn = false;
    var currentTags = [];
    var currentPhotos = []; /* [{ dataUrl, desc }] */
    var pendingPhotoDataUrl = null;

    /* 首次渲染日记流 */
    renderFeed();

    /* 返回按钮 */
    if (backBtn){
      backBtn.addEventListener('click', function(){
        if (window.navigator && window.navigator.vibrate){
          try{ window.navigator.vibrate(5); }catch(e){}
        }
        if (window.history.length > 1){
          window.history.back();
        }
      });
    }

    function updateDatestamp(){
      var now = new Date();
      if (cdsMonth) cdsMonth.textContent = MONTHS_EN[now.getMonth()] + ' ' + now.getFullYear();
      if (cdsWeek) cdsWeek.textContent = WEEKDAYS_CN[now.getDay()];
      var dayEl = document.querySelector('.cds-day');
      if (dayEl) dayEl.textContent = pad2(now.getDate());
    }

    function openComposer(){
      updateDatestamp();
      veil.classList.add('show');
      composer.classList.add('show');
      composer.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      setTimeout(function(){ if (titleInput) titleInput.focus({ preventScroll: true }); }, 380);
    }

    function closeComposer(){
      /* 先把焦点移出即将被 aria-hidden 的容器，避免"隐藏一个仍被聚焦的元素"这类
         无障碍访问警告（浏览器会阻止把焦点还留在内部的容器标记为 aria-hidden）。
         用 document.activeElement 判断更稳妥：无论当前焦点在标题、正文、
         取消按钮还是其他任何composer内部元素上，都统一处理。 */
      var active = document.activeElement;
      if (active && composer.contains(active)){
        active.blur();
      }
      /* 保险起见，把焦点交还给 body */
      if (document.activeElement && composer.contains(document.activeElement)){
        document.body.focus();
      }

      veil.classList.remove('show');
      composer.classList.remove('show');
      composer.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (weatherPicker) weatherPicker.hidden = true;
    }

    function renderPhotoSlots(){
      if (!photoSlots) return;
      /* 清空除了 add 按钮之外的所有卡片 */
      photoSlots.querySelectorAll('.photo-card').forEach(function(el){ el.remove(); });
      currentPhotos.forEach(function(p, i){
        var card = document.createElement('div');
        card.className = 'photo-card';
        card.innerHTML =
          '<img src="' + p.dataUrl + '" alt="' + escapeHtml(p.desc || '') + '" />' +
          '<span class="photo-card-desc-mark"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h10M4 18h7"/></svg></span>' +
          '<button class="photo-card-remove" type="button" data-idx="' + i + '"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
        photoSlots.insertBefore(card, photoAddBtn);
      });
      /* 最多 4 张 */
      photoAddBtn.style.display = currentPhotos.length >= 4 ? 'none' : '';

      photoSlots.querySelectorAll('.photo-card-remove').forEach(function(btn){
        btn.addEventListener('click', function(){
          var idx = parseInt(btn.dataset.idx, 10);
          currentPhotos.splice(idx, 1);
          renderPhotoSlots();
        });
      });
    }

    function renderTagChips(){
      if (!tagList) return;
      tagList.innerHTML = currentTags.map(function(t, i){
        return '<span class="tag-chip">' + escapeHtml(t) +
          '<button class="tag-chip-remove" type="button" data-idx="' + i + '">×</button></span>';
      }).join('');
      tagList.querySelectorAll('.tag-chip-remove').forEach(function(btn){
        btn.addEventListener('click', function(){
          var idx = parseInt(btn.dataset.idx, 10);
          currentTags.splice(idx, 1);
          renderTagChips();
        });
      });
    }

    function resetComposer(){
      if (titleInput) titleInput.value = '';
      if (textInput) textInput.value = '';
      selectedMood = 'calm';
      selectedWeather = '';
      locationOn = false;
      currentTags = [];
      currentPhotos = [];

      moodRow.querySelectorAll('.mood-chip').forEach(function(chip){
        chip.classList.toggle('active', chip.dataset.mood === 'calm');
      });
      if (weatherTagBtn){
        weatherTagBtn.classList.remove('active');
        weatherTagText.textContent = '天气';
        weatherTagIcon.innerHTML = '<path d="M7 15a4 4 0 0 1 .7-7.9A5 5 0 0 1 17.4 9 3.6 3.6 0 0 1 17 16H7Z"/>';
      }
      if (weatherPicker){
        weatherPicker.hidden = true;
        weatherPicker.querySelectorAll('.weather-opt').forEach(function(o){ o.classList.remove('active'); });
      }
      if (locationTagBtn){
        locationTagBtn.classList.remove('active');
        locationTagText.textContent = '此刻';
      }
      if (tagInput) tagInput.value = '';
      renderTagChips();
      renderPhotoSlots();
      updateCounter();
    }

    function updateCounter(){
      var len = textInput ? textInput.value.trim().length : 0;
      if (cfCountNum) cfCountNum.textContent = len;
      var ready = len > 0;
      if (publishBtn) publishBtn.disabled = !ready;
      if (cfDraftHint){
        cfDraftHint.textContent = ready ? '墨迹已成' : '尚未落笔';
        cfDraftHint.classList.toggle('ready', ready);
      }
    }

    if (writeBtn){
      writeBtn.addEventListener('click', function(){
        if (window.navigator && window.navigator.vibrate){
          try{ window.navigator.vibrate(6); }catch(e){}
        }
        openComposer();
      });
    }

    if (cancelBtn) cancelBtn.addEventListener('click', closeComposer);
    if (veil) veil.addEventListener('click', closeComposer);

    /* 心情选择 */
    if (moodRow){
      moodRow.querySelectorAll('.mood-chip').forEach(function(chip){
        chip.addEventListener('click', function(){
          selectedMood = chip.dataset.mood;
          moodRow.querySelectorAll('.mood-chip').forEach(function(c){
            c.classList.toggle('active', c === chip);
          });
          if (window.navigator && window.navigator.vibrate){
            try{ window.navigator.vibrate(4); }catch(e){}
          }
        });
      });
    }

    /* 天气胶囊：点击展开/收起选择条 */
    if (weatherTagBtn && weatherPicker){
      weatherTagBtn.addEventListener('click', function(){
        weatherPicker.hidden = !weatherPicker.hidden;
      });
      weatherPicker.querySelectorAll('.weather-opt').forEach(function(opt){
        opt.addEventListener('click', function(){
          selectedWeather = opt.dataset.weather;
          weatherPicker.querySelectorAll('.weather-opt').forEach(function(o){
            o.classList.toggle('active', o === opt);
          });
          weatherTagBtn.classList.add('active');
          weatherTagText.textContent = opt.dataset.label;
          weatherTagIcon.innerHTML = opt.querySelector('svg').innerHTML;
          weatherPicker.hidden = true;
        });
      });
    }

    /* 位置胶囊：简单开关，标记"此刻"是否附带位置氛围（不做真实地理定位，保持轻量与隐私友好） */
    if (locationTagBtn){
      locationTagBtn.addEventListener('click', function(){
        locationOn = !locationOn;
        locationTagBtn.classList.toggle('active', locationOn);
        locationTagText.textContent = locationOn ? '已标记' : '此刻';
      });
    }

    /* 把图片压缩到合理尺寸再转 dataURL，避免原图直接塞进 localStorage 撑爆容量配额。
       长边限制在 1280px，用 JPEG 有损压缩，体积通常能降到原图的十分之一左右。 */
    function compressImageToDataUrl(file, callback){
      var reader = new FileReader();
      reader.onload = function(e){
        var img = new Image();
        img.onload = function(){
          var maxSide = 1280;
          var w = img.naturalWidth, h = img.naturalHeight;
          var scale = Math.min(1, maxSide / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * scale));
          var ch = Math.max(1, Math.round(h * scale));
          try{
            var canvas = document.createElement('canvas');
            canvas.width = cw; canvas.height = ch;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, cw, ch);
            var out = canvas.toDataURL('image/jpeg', 0.82);
            callback(out);
          }catch(err){
            /* 压缩失败（比如 canvas 被安全策略限制），退回原图，至少功能不中断 */
            callback(e.target.result);
          }
        };
        img.onerror = function(){ callback(e.target.result); };
        img.src = e.target.result;
      };
      reader.onerror = function(){ callback(null); };
      reader.readAsDataURL(file);
    }

    /* 配图：选择文件 → 压缩 → 弹出描述弹层 → 确认后加入 currentPhotos */
    if (photoAddBtn && photoFileInput){
      photoAddBtn.addEventListener('click', function(){
        photoFileInput.click();
      });
      photoFileInput.addEventListener('change', function(){
        var file = photoFileInput.files && photoFileInput.files[0];
        if (!file) return;
        compressImageToDataUrl(file, function(dataUrl){
          if (!dataUrl) return;
          pendingPhotoDataUrl = dataUrl;
          openPhotoDescModal(pendingPhotoDataUrl);
        });
        photoFileInput.value = '';
      });
    }

    function openPhotoDescModal(dataUrl){
      pdmPreview.style.backgroundImage = 'url(' + dataUrl + ')';
      pdmTextarea.value = '';
      pdmCountNum.textContent = '0';
      pdmConfirmBtn.disabled = true;
      photoDescVeil.classList.add('show');
      photoDescModal.classList.add('show');
      photoDescModal.setAttribute('aria-hidden', 'false');
      setTimeout(function(){ pdmTextarea.focus(); }, 260);
    }

    function closePhotoDescModal(){
      var active = document.activeElement;
      if (active && photoDescModal.contains(active)){
        active.blur();
      }
      photoDescVeil.classList.remove('show');
      photoDescModal.classList.remove('show');
      photoDescModal.setAttribute('aria-hidden', 'true');
      pendingPhotoDataUrl = null;
    }

    if (pdmTextarea){
      pdmTextarea.addEventListener('input', function(){
        var len = pdmTextarea.value.trim().length;
        pdmCountNum.textContent = len;
        pdmConfirmBtn.disabled = len === 0;
      });
    }
    if (pdmCancelBtn) pdmCancelBtn.addEventListener('click', closePhotoDescModal);
    if (photoDescVeil) photoDescVeil.addEventListener('click', closePhotoDescModal);
    if (pdmConfirmBtn){
      pdmConfirmBtn.addEventListener('click', function(){
        if (pdmConfirmBtn.disabled || !pendingPhotoDataUrl) return;
        currentPhotos.push({
          dataUrl: pendingPhotoDataUrl,
          desc: pdmTextarea.value.trim()
        });
        renderPhotoSlots();
        closePhotoDescModal();
      });
    }

    /* 标签：回车添加，最多 5 个 */
    if (tagInput){
      tagInput.addEventListener('keydown', function(e){
        if (e.key !== 'Enter') return;
        e.preventDefault();
        var val = tagInput.value.trim();
        if (!val) return;
        if (currentTags.length >= 5) return;
        if (currentTags.indexOf(val) !== -1){ tagInput.value = ''; return; }
        currentTags.push(val);
        tagInput.value = '';
        renderTagChips();
      });
    }

    if (textInput) textInput.addEventListener('input', updateCounter);

    if (publishBtn){
      publishBtn.addEventListener('click', function(){
        if (publishBtn.disabled) return;

        var entry = {
          id: 'e_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          ts: Date.now(),
          title: (titleInput.value || '').trim(),
          body: (textInput.value || '').trim(),
          mood: selectedMood,
          weather: selectedWeather,
          location: locationOn ? '已标记地点' : '',
          tags: currentTags.slice(),
          photos: currentPhotos.slice()
        };

        var list = loadEntries();
        list.push(entry);
        var saved = saveEntries(list);

        if (!saved){
          /* 保存真的失败了（多半是照片太多/太大，超出本地存储空间），
             绝不能假装成功后关闭编辑框，否则用户刚写的内容会直接丢失。 */
          if (window.alert){
            window.alert('保存失败：本地存储空间可能已满（通常是照片太多或太大导致）。\n请尝试删除几张照片后再发布，你刚写的内容还留在编辑框里，不会丢失。');
          }
          return;
        }

        if (window.navigator && window.navigator.vibrate){
          try{ window.navigator.vibrate([8, 30, 8]); }catch(e){}
        }

        closeComposer();
        resetComposer();
        renderFeed();

        /* 发布成功的印章反馈 */
        if (stamp){
          stamp.classList.remove('fire');
          void stamp.offsetWidth;
          stamp.classList.add('fire');
        }
      });
    }

    renderPhotoSlots();
    renderTagChips();
    updateCounter();
  });

  /* ============================================================
     Part D —— 日记详情页 + 四枚功能卡片
     openDetailPage(entryId)：从日记流某张卡片跳转展示完整内容
     四枚功能卡片：共感梦境 / 时空胶囊 / 灵魂回想 / 侧笔记录，
     点开后各自呈现基于该篇日记内容生成的呈现层（示范性渲染，
     数据来自该条日记本身：心情、正文、标签、时间等）。
  ============================================================ */

  var FEATURE_META = {
    dream: {
      title: '共感梦境', sub: 'Empathic Reverie',
      glyph: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3.5c-1 2-1 4 .3 5.3C13.6 10 15.7 10 17.7 9c-.6 2.4-2.6 4.3-5.1 4.7-3.4.5-6.6-1.7-7.3-5C4.7 5.4 8 2.6 12 3.5Z"/><circle cx="17" cy="15.5" r="0.9" fill="currentColor" stroke="none"/><circle cx="8.5" cy="18.5" r="0.6" fill="currentColor" stroke="none"/></svg>',
      color: 'var(--lilac-deep)'
    },
    capsule: {
      title: '时空胶囊', sub: 'Time Capsule',
      glyph: '<svg viewBox="0 0 24 24" fill="none"><ellipse cx="12" cy="12" rx="7.5" ry="9.5"/><path d="M4.5 12h15M12 2.5v19"/></svg>',
      color: 'var(--rose-deep)'
    },
    soul: {
      title: '灵魂回想', sub: 'Soul Recall',
      glyph: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 20c-.3 0-.6-.1-.8-.3C7.8 16.9 5 14.4 5 11.3 5 9 6.8 7.2 9 7.2c1.1 0 2.2.5 3 1.4.8-.9 1.9-1.4 3-1.4 2.2 0 4 1.8 4 4.1 0 3.1-2.8 5.6-6.2 8.4-.2.2-.5.3-.8.3Z"/></svg>',
      color: '#b89a5c'
    },
    margin: {
      title: '侧笔记录', sub: 'Margin Notes',
      glyph: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 19 L5.7 15.9C5.8 15.4 6.05 14.95 6.4 14.6 L15.3 5.7C16.1 4.9 17.4 4.9 18.2 5.7L18.3 5.8C19.1 6.6 19.1 7.9 18.3 8.7L9.4 17.6C9.05 17.95 8.6 18.2 8.1 18.3Z"/></svg>',
      color: '#6f85a8'
    }
  };

  document.addEventListener('DOMContentLoaded', function(){

    var detailVeil = document.getElementById('detailVeil');
    var detailPage = document.getElementById('detailPage');
    var detailBackBtn = document.getElementById('detailBackBtn');
    var detailMoreBtn = document.getElementById('detailMoreBtn');
    var detailScroll = document.getElementById('detailScroll');

    var detailDay = document.getElementById('detailDay');
    var detailWeekday = document.getElementById('detailWeekday');
    var detailMonth = document.getElementById('detailMonth');
    var detailTime = document.getElementById('detailTime');
    var detailConditionRow = document.getElementById('detailConditionRow');
    var detailTitle = document.getElementById('detailTitle');
    var detailBody = document.getElementById('detailBody');
    var detailGallery = document.getElementById('detailGallery');
    var detailTags = document.getElementById('detailTags');
    var detailWordCount = document.getElementById('detailWordCount');

    var featureVeil = document.getElementById('featureVeil');
    var featureModal = document.getElementById('featureModal');
    var fmGlyphMini = document.getElementById('fmGlyphMini');
    var fmTitle = document.getElementById('fmTitle');
    var fmSub = document.getElementById('fmSub');
    var fmBody = document.getElementById('fmBody');
    var fmCloseBtn = document.getElementById('fmCloseBtn');

    var currentEntry = null;

    /* ---- 打开 / 关闭 详情页 ---- */
    window.openDetailPage = function(entryId){
      var entries = loadEntries();
      var entry = entries.filter(function(e){ return e.id === entryId; })[0];
      if (!entry) return;
      currentEntry = entry;
      renderDetailContent(entry);

      detailVeil.classList.add('show');
      detailPage.classList.add('show');
      detailPage.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      if (detailScroll) detailScroll.scrollTop = 0;
    };

    function closeDetailPage(){
      var active = document.activeElement;
      if (active && detailPage.contains(active)) active.blur();
      detailVeil.classList.remove('show');
      detailPage.classList.remove('show');
      detailPage.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      currentEntry = null;
    }

    if (detailBackBtn){
      detailBackBtn.addEventListener('click', function(){
        if (window.navigator && window.navigator.vibrate){
          try{ window.navigator.vibrate(5); }catch(e){}
        }
        closeDetailPage();
      });
    }
    if (detailVeil) detailVeil.addEventListener('click', closeDetailPage);
    if (detailMoreBtn){
      detailMoreBtn.addEventListener('click', function(){
        if (window.navigator && window.navigator.vibrate){
          try{ window.navigator.vibrate(4); }catch(e){}
        }
      });
    }

    function renderDetailContent(entry){
      var d = new Date(entry.ts);
      var mood = MOOD_META[entry.mood] || MOOD_META.calm;

      if (detailDay) detailDay.textContent = pad2(d.getDate());
      if (detailWeekday) detailWeekday.textContent = WEEKDAYS_CN[d.getDay()];
      if (detailMonth) detailMonth.textContent = MONTHS_EN[d.getMonth()] + ' ' + d.getFullYear();
      if (detailTime) detailTime.textContent = '— ' + fmtEntryTime(entry.ts) + ' 落笔';

      /* 心情 · 天气 · 位置 条 */
      var condHtml = '<span class="dcr-chip dcr-mood" data-mood="' + entry.mood + '">' + mood.icon + '<span>' + mood.label + '</span></span>';
      if (entry.weather && WEATHER_META[entry.weather]){
        condHtml += '<span class="dcr-chip dcr-weather">' + WEATHER_META[entry.weather].icon + '<span>' + WEATHER_META[entry.weather].label + '</span></span>';
      }
      if (entry.location){
        condHtml += '<span class="dcr-chip dcr-location"><svg viewBox="0 0 24 24"><path d="M12 21s-6.5-6-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2"/></svg><span>' + escapeHtml(entry.location) + '</span></span>';
      }
      if (detailConditionRow) detailConditionRow.innerHTML = condHtml;

      if (detailTitle) detailTitle.textContent = entry.title || '无题';
      if (detailBody) detailBody.textContent = entry.body || '';

      /* 配图长廊 */
      if (detailGallery){
        if (entry.photos && entry.photos.length){
          detailGallery.hidden = false;
          detailGallery.innerHTML = entry.photos.map(function(p){
            return '<div class="detail-gallery-item">' +
              '<img src="' + p.dataUrl + '" alt="' + escapeHtml(p.desc || '') + '" />' +
              (p.desc ? '<div class="detail-gallery-alt">' + escapeHtml(p.desc) + '</div>' : '') +
            '</div>';
          }).join('');
        } else {
          detailGallery.hidden = true;
          detailGallery.innerHTML = '';
        }
      }

      /* 标签 */
      if (detailTags){
        if (entry.tags && entry.tags.length){
          detailTags.hidden = false;
          detailTags.innerHTML = entry.tags.map(function(t){
            return '<span class="detail-tag">' + escapeHtml(t) + '</span>';
          }).join('');
        } else {
          detailTags.hidden = true;
          detailTags.innerHTML = '';
        }
      }

      var charCount = (entry.body || '').length;
      if (detailWordCount) detailWordCount.textContent = charCount + ' 字' + (entry.photos && entry.photos.length ? '　·　' + entry.photos.length + ' 图' : '');

      /* 共感梦境归档数量徽标（数据源：diary/dream.js 写入的 luna_dream_archive） */
      var dreamCountEl = document.getElementById('fcDreamCount');
      if (dreamCountEl){
        try{
          var dreamStore = JSON.parse(localStorage.getItem('luna_dream_archive') || '{}');
          var dreamList = (dreamStore && dreamStore[entry.id]) || [];
          if (dreamList.length){
            dreamCountEl.textContent = dreamList.length > 9 ? '9+' : String(dreamList.length);
            dreamCountEl.hidden = false;
          } else {
            dreamCountEl.hidden = true;
          }
        }catch(e){ dreamCountEl.hidden = true; }
      }

      /* 时空胶囊归档数量徽标（数据源：diary/capsule.js 写入的 luna_capsule_archive，
         仅统计已开启的胶囊数量，封存中的不计入，避免误导为"已完成"数） */
      var capsuleCountEl = document.getElementById('fcCapsuleCount');
      if (capsuleCountEl){
        try{
          var capsuleStore = JSON.parse(localStorage.getItem('luna_capsule_archive') || '{}');
          var capsuleList = (capsuleStore && capsuleStore[entry.id]) || [];
          var openedCount = capsuleList.filter(function(c){ return c.status === 'opened'; }).length;
          var sealedCount = capsuleList.filter(function(c){ return c.status === 'sealed'; }).length;
          if (openedCount > 0){
            capsuleCountEl.textContent = openedCount > 9 ? '9+' : String(openedCount);
            capsuleCountEl.hidden = false;
          } else if (sealedCount > 0){
            /* 有胶囊正在封存中但尚未开启：显示一个沙漏样式的占位徽标 */
            capsuleCountEl.textContent = '·';
            capsuleCountEl.hidden = false;
          } else {
            capsuleCountEl.hidden = true;
          }
        }catch(e){ capsuleCountEl.hidden = true; }
      }

      /* 灵魂回想归档数量徽标（数据源：diary/soul.js 写入的 luna_soul_archive） */
      var soulCountEl = document.getElementById('fcSoulCount');
      if (soulCountEl){
        try{
          var soulStore = JSON.parse(localStorage.getItem('luna_soul_archive') || '{}');
          var soulList = (soulStore && soulStore[entry.id]) || [];
          if (soulList.length){
            soulCountEl.textContent = soulList.length > 9 ? '9+' : String(soulList.length);
            soulCountEl.hidden = false;
          } else {
            soulCountEl.hidden = true;
          }
        }catch(e){ soulCountEl.hidden = true; }
      }
    }

    /* ---- 四枚功能卡片 ---- */
    var featureCards = Array.prototype.slice.call(document.querySelectorAll('.feature-card'));

    featureCards.forEach(function(card){
      card.addEventListener('click', function(){
        if (!currentEntry) return;
        if (window.navigator && window.navigator.vibrate){
          try{ window.navigator.vibrate(6); }catch(e){}
        }
        /* 「共感梦境」与「时空胶囊」均独立成页：跳转至 diary/ 子目录下的
           完整体验页，而不再使用旧版占位浮层，其余两枚功能卡片保持原有浮层逻辑不变 */
        if (card.dataset.feature === 'dream'){
          window.location.href = 'diary/dream.html?entryId=' + encodeURIComponent(currentEntry.id);
          return;
        }
        if (card.dataset.feature === 'capsule'){
          window.location.href = 'diary/capsule.html?entryId=' + encodeURIComponent(currentEntry.id);
          return;
        }
        if (card.dataset.feature === 'soul'){
          window.location.href = 'diary/soul.html?entryId=' + encodeURIComponent(currentEntry.id);
          return;
        }
        /* 「侧笔记录」同样独立成页：跳转至 diary/margin.html，
           在那里同步角色列表，并生成角色对这篇日记的解读 + 内心真实想法 */
        if (card.dataset.feature === 'margin'){
          window.location.href = 'diary/margin.html?entryId=' + encodeURIComponent(currentEntry.id);
          return;
        }
        openFeatureModal(card.dataset.feature, currentEntry);
      });
    });

    function openFeatureModal(feature, entry){
      var meta = FEATURE_META[feature];
      if (!meta) return;

      if (fmGlyphMini) fmGlyphMini.innerHTML = meta.glyph;
      if (fmGlyphMini) fmGlyphMini.style.color = meta.color;
      if (fmTitle) fmTitle.textContent = meta.title;
      if (fmSub) fmSub.textContent = meta.sub;
      if (fmBody) fmBody.innerHTML = buildFeatureBody(feature, entry);

      featureVeil.classList.add('show');
      featureModal.classList.add('show');
      featureModal.setAttribute('aria-hidden', 'false');
    }

    function closeFeatureModal(){
      var active = document.activeElement;
      if (active && featureModal.contains(active)) active.blur();
      featureVeil.classList.remove('show');
      featureModal.classList.remove('show');
      featureModal.setAttribute('aria-hidden', 'true');
    }

    if (fmCloseBtn) fmCloseBtn.addEventListener('click', closeFeatureModal);
    if (featureVeil) featureVeil.addEventListener('click', closeFeatureModal);

    /* ---- 四种功能内容渲染（基于当前日记条目的心情/正文/标签/时间生成呈现层） ---- */
    function buildFeatureBody(feature, entry){
      var mood = MOOD_META[entry.mood] || MOOD_META.calm;
      var titleSafe = escapeHtml(entry.title || '这段心情');
      var bodySnippet = (entry.body || '').slice(0, 60);

      if (feature === 'dream'){
        return (
          '<div class="fm-intro">日记入眠后，情绪会重新编织成片段的意象。以下是由《' + titleSafe + '》的' + mood.label + '氛围延展出的三段共感梦境切片。</div>' +
          '<div class="dream-fragments">' +
            '<div class="dream-fragment"><span class="df-label">Fragment · 甲</span><div class="df-text">回到写下这段文字的房间，光线和当时一样，落在你写"' + escapeHtml(bodySnippet || entry.title || '那一刻') + '"的这张桌上。</div></div>' +
            '<div class="dream-fragment"><span class="df-label">Fragment · 乙</span><div class="df-text">' + mood.label + '的情绪化作一片颜色，缓缓漫过梦境的边界，像是那天没说完的话终于有了回声。</div></div>' +
            '<div class="dream-fragment"><span class="df-label">Fragment · 丙</span><div class="df-text">醒来前的最后一帧，是这篇日记被重新合上的样子——安静，完整，被好好收进了时间里。</div></div>' +
          '</div>'
        );
      }

      if (feature === 'soul'){
        return (
          '<div class="fm-intro">灵魂回想，是把这篇日记翻到背面，问一问文字之外还藏着什么。</div>' +
          '<div class="soul-qa">' +
            '<div class="soul-qa-item"><div class="soul-q">这份' + mood.label + '，最初是从哪一刻开始的？</div><div class="soul-a">留意正文里最先出现情绪转折的那一句，那往往就是起点。</div></div>' +
            '<div class="soul-qa-item"><div class="soul-q">如果只能留下一句话，你会留下哪句？</div><div class="soul-a">"' + escapeHtml((entry.body || '').split(/[。！？\n]/).filter(Boolean)[0] || '此刻的心情') + '"</div></div>' +
            '<div class="soul-qa-item"><div class="soul-q">此刻的你，想对写下这篇日记的自己说什么？</div><div class="soul-a">这一格，留给你自己回答——灵魂的回想，本该由你亲自完成。</div></div>' +
          '</div>'
        );
      }

      return '';
    }

  });

  /* ============================================================
     Part D —— Char 日记 · 角色日记本书架
     数据源：与 characters.html 完全一致的 IndexedDB「LunaCharDB / chars」
     store，只读不写，实时同步角色的姓名 / 头像 / 角色定位 / 配色。
     每个角色的日记本版型（skin-a ~ skin-f）根据角色 id 做稳定哈希，
     保证同一个角色每次打开都拿到同一款版型，而不是每次刷新都乱跳。
  ============================================================ */
  (function(){

    var BOOK_SKINS = ['skin-a', 'skin-b', 'skin-c', 'skin-d', 'skin-e', 'skin-f'];

    var SKIN_META = {
      'skin-a': { plate: '云鸢卷', sub: 'CLOUD PAVILION' },
      'skin-b': { plate: '雾蔷笺', sub: 'ROSE MIST FOLIO' },
      'skin-c': { plate: '月霜录', sub: 'MOONFROST RECORD' },
      'skin-d': { plate: '鎏光帖', sub: 'GILDED PAGES' },
      'skin-e': { plate: '暮墨篇', sub: 'DUSK INK CHAPTER' },
      'skin-f': { plate: '霁色册', sub: 'CLEARING MIST TOME' }
    };

    /* 六套版型各自的中段纹样徽记（线描，随主题呼应：云纹/月桂细枝/大理石纹/
       几何星芒/星点弧光/水波纹），全部为纯 SVG 线稿，不使用任何位图或 emoji */
    var EMBLEM_SVGS = {
      'skin-a':
        '<svg viewBox="0 0 150 130" fill="none" stroke-width="1.1">' +
          '<path d="M20 80c8-14 22-18 34-10 6-16 24-20 34-8 10-10 28-8 34 4 8-6 20-2 22 8" />' +
          '<path d="M28 92c10-10 26-12 36-4 8-12 24-14 32-4 10-8 24-4 28 6" opacity="0.55"/>' +
          '<circle cx="75" cy="40" r="3" fill="currentColor" stroke="none" opacity="0.7"/>' +
          '<circle cx="95" cy="52" r="1.6" fill="currentColor" stroke="none" opacity="0.5"/>' +
          '<circle cx="55" cy="55" r="1.6" fill="currentColor" stroke="none" opacity="0.5"/>' +
        '</svg>',
      'skin-b':
        '<svg viewBox="0 0 150 130" fill="none" stroke-width="1">' +
          '<path d="M75 20v90" opacity="0.5"/>' +
          '<path d="M75 32c-14 4-22 14-22 26 12-2 20-10 22-22" />' +
          '<path d="M75 32c14 4 22 14 22 26-12-2-20-10-22-22" />' +
          '<path d="M75 54c-16 4-26 16-26 30 14-2 24-12 26-26" />' +
          '<path d="M75 54c16 4 26 16 26 30-14-2-24-12-26-26" />' +
          '<circle cx="75" cy="22" r="2.4" fill="currentColor" stroke="none"/>' +
        '</svg>',
      'skin-c':
        '<svg viewBox="0 0 150 130" fill="none" stroke-width="0.9">' +
          '<path d="M14 70c20-30 40-6 56-24s34 10 66-14" opacity="0.6"/>' +
          '<path d="M10 90c26-18 42 4 60-10s36 8 68-8" opacity="0.4"/>' +
          '<path d="M18 50c22-14 38 8 54-4s34-8 60 6" opacity="0.35"/>' +
        '</svg>',
      'skin-d':
        '<svg viewBox="0 0 150 130" fill="none" stroke-width="1">' +
          '<path d="M75 24 L86 58 L122 58 L93 79 L104 113 L75 92 L46 113 L57 79 L28 58 L64 58 Z" />' +
          '<circle cx="75" cy="65" r="34" opacity="0.4"/>' +
        '</svg>',
      'skin-e':
        '<svg viewBox="0 0 150 130" fill="none" stroke-width="1">' +
          '<path d="M75 18c-4 16-4 28 6 36 10 8 24 8 34-2-4 18-18 30-38 34-26 4-50-12-56-38C16 26 34 12 56 16c8 2 16 6 19 2Z" class="emblem-fill" stroke="none" opacity="0.9"/>' +
          '<circle cx="112" cy="34" r="1.6" fill="currentColor" stroke="none"/>' +
          '<circle cx="122" cy="50" r="1" fill="currentColor" stroke="none"/>' +
          '<circle cx="100" cy="24" r="1.2" fill="currentColor" stroke="none"/>' +
        '</svg>',
      'skin-f':
        '<svg viewBox="0 0 150 130" fill="none" stroke-width="1">' +
          '<path d="M12 50c10-8 20-8 30 0s20 8 30 0 20-8 30 0 20 8 30 0" opacity="0.6"/>' +
          '<path d="M12 68c10-8 20-8 30 0s20 8 30 0 20-8 30 0 20 8 30 0" opacity="0.4"/>' +
          '<path d="M12 86c10-8 20-8 30 0s20 8 30 0 20-8 30 0 20 8 30 0" opacity="0.25"/>' +
        '</svg>'
    };

    /* 与 characters.js 完全一致的字段名，色阶仅在此处按需借用 avBg/avCol
       用于头像无图时的字母占位底色，不引入完整 COLOR_MAP 也能拿到近似质感 */
    var CHAR_COLOR_FALLBACK = {
      ink: '#101012', slate: '#141416', silver: '#1a1a1c',
      frost: '#111316', smoke: '#0e0e10', pearl: '#1c1c1e'
    };

    function escHtml(str){
      var div = document.createElement('div');
      div.textContent = str == null ? '' : String(str);
      return div.innerHTML;
    }

    /* 稳定哈希：同一个角色永远落到同一个版型，不随刷新跳变。
       仅用自增 id 做 mod 在小样本下极易连续撞车（1~7 号角色六选一，
       必然有两个撞在同一版型），这里用 id 拼接姓名做字符串哈希（djb2），
       再叠加一次 murmur 风格的雪崩混合（xorshift + 两次 imul），
       充分打散分布，避免相邻创建的角色扎堆落在同一版型上 */
    function skinForId(id, name){
      var str = String(id == null ? '' : id) + '::' + String(name || '');
      var hash = 5381;
      for (var i = 0; i < str.length; i++){
        hash = ((hash << 5) + hash) + str.charCodeAt(i); /* djb2 */
        hash = hash & 0xffffffff;
      }
      hash ^= hash >>> 15;
      hash = Math.imul(hash, 2246822519);
      hash ^= hash >>> 13;
      hash = Math.imul(hash, 3266489917);
      hash ^= hash >>> 16;
      var idx = Math.abs(hash) % BOOK_SKINS.length;
      return BOOK_SKINS[idx];
    }

    /* ---- 读取 LunaCharDB（与 characters.js 同源同库，只读） ---- */
    function openCharDBReadOnly(){
      return new Promise(function(resolve){
        try{
          var probe = indexedDB.open('LunaCharDB');
          probe.onsuccess = function(e){
            var db = e.target.result;
            resolve(db.objectStoreNames.contains('chars') ? db : null);
          };
          probe.onerror = function(){ resolve(null); };
          probe.onupgradeneeded = function(e){
            /* 探测触发了升级，说明库原本不存在角色数据，直接判定为空 */
            try{ e.target.transaction.abort(); }catch(err){}
            resolve(null);
          };
        }catch(err){ resolve(null); }
      });
    }

    function getAllCharsReadOnly(){
      return openCharDBReadOnly().then(function(db){
        if (!db) return [];
        return new Promise(function(resolve){
          try{
            var req = db.transaction('chars', 'readonly').objectStore('chars').getAll();
            req.onsuccess = function(){ resolve(req.result || []); };
            req.onerror = function(){ resolve([]); };
          }catch(err){ resolve([]); }
        });
      });
    }

    function renderCharAvatar(c){
      if (c.avatar){
        return '<img src="' + c.avatar + '" alt="' + escHtml(c.name || '') + '" />';
      }
      var letter = (c.name || '?').trim().charAt(0).toUpperCase() || '?';
      return '<span>' + escHtml(letter) + '</span>';
    }

    function buildBookSlide(c, index){
      var skin = skinForId(c.id != null ? c.id : index, c.name);
      var meta = SKIN_META[skin];
      var emblem = EMBLEM_SVGS[skin] || '';
      var role = (c.role || c.relation || '未署名的角色').trim();
      /* 与用户的关系称谓（若有）优先作为副标题，比通用"角色"更有代入感 */
      var roleLabel = role.length > 14 ? role.slice(0, 14) + '…' : role;

      return (
        '<div class="char-book-slide">' +
          '<div class="char-book ' + skin + '" data-char-id="' + c.id + '">' +
            '<div class="char-book-shadow"></div>' +
            '<div class="char-book-pages"></div>' +
            '<div class="char-book-spine"></div>' +
            '<div class="char-book-cover">' +
              '<div class="cbc-crest">' +
                '<div class="cbc-avatar-ring">' +
                  '<div class="cbc-avatar">' + renderCharAvatar(c) + '</div>' +
                '</div>' +
                '<div class="cbc-name">' + escHtml(c.name || '未命名') + '</div>' +
                '<div class="cbc-role">' + escHtml(roleLabel) + '</div>' +
              '</div>' +
              '<div class="cbc-emblem">' + emblem + '</div>' +
              '<div class="cbc-plate">' +
                '<div class="cbc-plate-title">「' + meta.plate + '」</div>' +
                '<div class="cbc-plate-meta">' +
                  '<span>' + meta.sub + '</span>' +
                  '<span class="cpm-dot"></span>' +
                  '<span>0 篇</span>' +
                '</div>' +
              '</div>' +
              '<div class="cbc-empty-tag">' +
                '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v4.5l3 2" stroke-linecap="round"/></svg>' +
                '<span>尚未落笔</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }

    function renderCharDots(count){
      var dotsEl = document.getElementById('charShelfDots');
      if (!dotsEl) return;
      if (count <= 1){ dotsEl.innerHTML = ''; return; }
      var html = '';
      for (var i = 0; i < count; i++){
        html += '<span class="char-shelf-dot' + (i === 0 ? ' active' : '') + '"></span>';
      }
      dotsEl.innerHTML = html;
    }

    function bindShelfScrollSync(){
      var shelf = document.getElementById('charShelf');
      var dotsEl = document.getElementById('charShelfDots');
      if (!shelf || !dotsEl) return;
      var dots = Array.prototype.slice.call(dotsEl.querySelectorAll('.char-shelf-dot'));
      if (!dots.length) return;

      var ticking = false;
      shelf.addEventListener('scroll', function(){
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function(){
          var slideW = shelf.clientWidth || 1;
          var idx = Math.round(shelf.scrollLeft / slideW);
          idx = Math.max(0, Math.min(dots.length - 1, idx));
          dots.forEach(function(d, i){ d.classList.toggle('active', i === idx); });
          ticking = false;
        });
      }, { passive: true });
    }

    var _charShelfCache = [];

    function bindBookTapFeedback(){
      var shelf = document.getElementById('charShelf');
      if (!shelf) return;
      shelf.addEventListener('click', function(e){
        var book = e.target.closest ? e.target.closest('.char-book') : null;
        if (!book) return;
        if (window.navigator && window.navigator.vibrate){
          try{ window.navigator.vibrate(6); }catch(err){}
        }
        var charId = book.getAttribute('data-char-id');
        var skin = (BOOK_SKINS.filter(function(s){ return book.classList.contains(s); })[0]) || 'skin-a';
        var char = _charShelfCache.filter(function(c){ return String(c.id) === String(charId); })[0];
        if (char && window.openCharDiaryHome){
          window.openCharDiaryHome(char, skin);
        }
      });
    }

    function renderCharShelf(chars){
      var emptyEl = document.getElementById('charDiaryEmpty');
      var shelfWrap = document.getElementById('charShelfWrap');
      var shelf = document.getElementById('charShelf');
      var countEl = document.getElementById('ctbCount');
      var topbar = document.getElementById('charTopbar');
      if (!emptyEl || !shelfWrap || !shelf) return;

      _charShelfCache = chars || [];
      window._LunaCharDiaryLastChars = _charShelfCache; /* 供背景设置模块反查角色对象 */
      if (countEl) countEl.textContent = String(chars.length);

      if (!chars.length){
        emptyEl.hidden = false;
        shelfWrap.hidden = true;
        if (topbar) topbar.style.opacity = '0.45';
        return;
      }

      if (topbar) topbar.style.opacity = '';
      emptyEl.hidden = true;
      shelfWrap.hidden = false;

      shelf.innerHTML = chars.map(function(c, i){ return buildBookSlide(c, i); }).join('');
      renderCharDots(chars.length);
      bindShelfScrollSync();
      bindBookTapFeedback();
      if (window._LunaCharBg && window._LunaCharBg.applyToShelf) window._LunaCharBg.applyToShelf();
    }

    var _charShelfLoaded = false;

    function loadAndRenderChars(){
      getAllCharsReadOnly().then(function(chars){
        renderCharShelf(chars || []);
        _charShelfLoaded = true;
      });
    }

    /* 暴露给「Char 日记专属主页」模块复用，保证两处的版型判定 / 徽记 /
       头像渲染完全一致，角色在书架封面与专属主页内是"同一套视觉身份" */
    window._LunaCharBookShared = {
      BOOK_SKINS: BOOK_SKINS,
      SKIN_META: SKIN_META,
      EMBLEM_SVGS: EMBLEM_SVGS,
      skinForId: skinForId,
      renderCharAvatar: renderCharAvatar,
      escHtml: escHtml
    };

    /* 首次进入即加载一次；此外当「Char日记」tab 被真正点开时也刷新一次，
       确保用户在角色档案页新增角色后，回到日记页能看到最新的书架 */
    document.addEventListener('DOMContentLoaded', function(){
      loadAndRenderChars();

      var charTabBtn = document.querySelector('.diary-tab[data-tab="char"]');
      if (charTabBtn){
        charTabBtn.addEventListener('click', function(){
          loadAndRenderChars();
        });
      }
    });

    /* 角色档案页保存/删除角色后会写入 luna_char_db_update，跨标签页同步刷新 */
    window.addEventListener('storage', function(e){
      if (e.key === 'luna_char_db_update' || e.key === 'luna_characters_updated'){
        loadAndRenderChars();
      }
    });

  })();

  /* ================================================================
     Part E —— Char 日记专属主页
     点击书架上任意一本角色日记本后打开的全屏页面。

     本模块职责边界（重要）：
     - 日历交互、时间轴渲染、卡片版式、节假日标注 —— 全部为真实可用的
       前端交互与样式，现在就能操作。
     - 每一天日记的"篇数"与"内容摘要文案" —— 目前为按角色人设 + 日期
       做确定性伪随机生成的占位内容，用来验证日历→时间轴的信息流转
       是否合理、排版是否成立。后续接入真实 AI 生成接口时，只需替换
       generatePlaceholderDayEntries() 这一处为真实请求（同一天多次访问
       应返回相同结果，接口设计上也建议按「角色+日期」做幂等缓存）。
  ================================================================ */
  (function(){

    /* ---- 与书架模块共享同一套版型判定，保证视觉身份统一 ---- */
    function shared(){ return window._LunaCharBookShared || {}; }

    /* ----------------------------------------------------------
       中国大陆法定节假日 + 部分国际通用节日（阳历部分）静态表。
       仅覆盖会被本页日历展示到的年份范围，逐年补充即可。
       农历节日（春节/中秋/端午等）以其阳历日期硬编码，
       因为纯前端做农历换算成本过高，此处用近似年度对照表代替，
       实际项目中建议后端下发准确节假日数据。
    ---------------------------------------------------------- */
    var HOLIDAYS = {
      '2025-01-01': '元旦', '2025-01-28': '除夕', '2025-01-29': '春节',
      '2025-01-30': '春节', '2025-02-14': '情人节', '2025-04-04': '清明节',
      '2025-05-01': '劳动节', '2025-05-31': '端午节', '2025-06-01': '儿童节',
      '2025-08-29': '七夕节', '2025-09-06': '中秋节', '2025-10-01': '国庆节',
      '2025-10-06': '中秋节', '2025-12-24': '平安夜', '2025-12-25': '圣诞节',
      '2026-01-01': '元旦', '2026-02-14': '情人节', '2026-02-16': '除夕',
      '2026-02-17': '春节', '2026-02-18': '春节', '2026-03-08': '妇女节',
      '2026-04-04': '清明节', '2026-04-05': '清明节', '2026-05-01': '劳动节',
      '2026-06-01': '儿童节', '2026-06-19': '端午节', '2026-08-19': '七夕节',
      '2026-09-25': '中秋节', '2026-10-01': '国庆节', '2026-10-02': '国庆节',
      '2026-10-03': '国庆节', '2026-12-24': '平安夜', '2026-12-25': '圣诞节',
      '2027-01-01': '元旦', '2027-02-06': '除夕', '2027-02-07': '春节',
      '2027-02-08': '春节', '2027-02-14': '情人节', '2027-04-04': '清明节',
      '2027-05-01': '劳动节', '2027-06-09': '端午节', '2027-08-08': '七夕节',
      '2027-09-15': '中秋节', '2027-10-01': '国庆节', '2027-12-25': '圣诞节'
    };

    function pad2(n){ return n < 10 ? '0' + n : String(n); }
    function ymdKey(y, m, d){ return y + '-' + pad2(m + 1) + '-' + pad2(d); }
    function isSameYMD(a, b){ return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

    var WEEKDAY_CN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    var MONTH_EN = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
    var MONTH_CN = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];

    /* ----------------------------------------------------------
       确定性哈希工具：同一角色 + 同一天，永远得到同一批生成结果，
       避免"今天看是 3 篇，刷新一下变成 5 篇"这种破坏沉浸感的跳变。
    ---------------------------------------------------------- */
    function hashStr(str){
      var hash = 5381;
      for (var i = 0; i < str.length; i++){
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash & 0xffffffff;
      }
      hash ^= hash >>> 15;
      hash = Math.imul(hash, 2246822519);
      hash ^= hash >>> 13;
      hash = Math.imul(hash, 3266489917);
      hash ^= hash >>> 16;
      return Math.abs(hash);
    }
    function seededRand(seedStr){
      var h = hashStr(seedStr) || 1;
      return function(){
        h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
        h = h & 0xffffffff;
        return ((h < 0 ? h + 4294967296 : h) % 100000) / 100000;
      };
    }

    /* 卡片版式池：拍立得 / 撕角纸条 / 打字机便签 / 蜡封信笺 / 剪影票根，
       每种自带不同的旋转角度与描边质感，具体样式在 diary.css 中定义 */
    var CARD_STYLES = ['polaroid', 'notestrip', 'typewriter', 'wax-letter', 'ticket'];

    /* 情绪 → 线描符号（复用 composer 的手绘心情图标语汇，非 emoji） */
    var MOOD_GLYPH = {
      calm:   '<svg viewBox="0 0 24 24"><path d="M4 14c2-2.5 4-2.5 6 0s4 2.5 6 0 4-2.5 6 0" /></svg>',
      joy:    '<svg viewBox="0 0 24 24"><path d="M5 13c1.5 3.2 4.2 5 7 5s5.5-1.8 7-5" /><circle cx="8.5" cy="9" r="0.9" fill="currentColor" stroke="none"/><circle cx="15.5" cy="9" r="0.9" fill="currentColor" stroke="none"/></svg>',
      tender: '<svg viewBox="0 0 24 24"><path d="M12 19c-.3 0-.6-.1-.8-.3C7.8 15.9 5 13.4 5 10.3 5 8 6.8 6.2 9 6.2c1.1 0 2.2.5 3 1.4.8-.9 1.9-1.4 3-1.4 2.2 0 4 1.8 4 4.1 0 3.1-2.8 5.6-6.2 8.4-.2.2-.5.3-.8.3Z" /></svg>',
      blue:   '<svg viewBox="0 0 24 24"><path d="M12 4c-4 4-7 7.4-7 10.6A7 7 0 0 0 12 21a7 7 0 0 0 7-6.4C19 11.4 16 8 12 4Z" /></svg>',
      storm:  '<svg viewBox="0 0 24 24"><path d="M7 9a5 5 0 0 1 9.6-1.8A4 4 0 0 1 17 15H7.5a3.5 3.5 0 0 1-.5-6.9Z" /></svg>'
    };
    var MOOD_LIST = ['calm', 'joy', 'tender', 'blue', 'storm'];
    var MOOD_LABEL = { calm: '平静', joy: '欢喜', tender: '柔软', blue: '低落', storm: '翻涌' };

    /* ----------------------------------------------------------
       占位内容生成：结合角色人设关键词（name / role / traits）与
       日期，产出「当天是否落笔 · 落笔几篇 · 每篇的情绪与摘要碎片」。
       ★ 这里是未来替换为真实 AI 生成接口的唯一位置 ★
       建议真实接口的请求体大致为：
         { charId, charName, persona: {role, traits, relationDetail...},
           date: 'YYYY-MM-DD', weekday, isHoliday, holidayName }
       返回体大致为：
         [{ mood, time, title, excerpt, style, wordCount }, ...]
       此刻返回的是可直接渲染、但内容为待接入状态的确定性占位数据。
    ---------------------------------------------------------- */
    function generatePlaceholderDayEntries(char, dateObj){
      var y = dateObj.getFullYear(), m = dateObj.getMonth(), d = dateObj.getDate();
      var key = ymdKey(y, m, d);
      var today = new Date(); today.setHours(0,0,0,0);
      var dCopy = new Date(y, m, d); dCopy.setHours(0,0,0,0);
      var isHoliday = !!HOLIDAYS[key];
      var base = {
        hasEntries: false, future: dCopy > today, count: 0, entries: [],
        isHoliday: isHoliday, holidayName: HOLIDAYS[key] || ''
      };
      if (base.future) return base;

      /* 真实数据源：char-diary.js 在角色主页打开时把该角色已生成的所有
         日记同步进内存缓存，这里做同步查表，保证日历/时间轴渲染是纯同步的。 */
      var ai = window._LunaCharDiaryAI;
      var day = (ai && char && ai.getDaySync) ? ai.getDaySync(char.id, key) : null;
      if (day && day.entries && day.entries.length){
        base.hasEntries = true;
        base.count = day.entries.length;
        base.entries = day.entries;
      }
      return base;
    }

    /* ============================================================
       日历渲染
    ============================================================ */
    var calState = { year: 0, month: 0, selectedKey: '' };

    function buildCalGrid(char, year, month){
      var gridEl = document.getElementById('cdhCalGrid');
      if (!gridEl) return;

      var firstDay = new Date(year, month, 1);
      var startOffset = (firstDay.getDay() + 6) % 7; /* 周一为一周首日 */
      var daysInMonth = new Date(year, month + 1, 0).getDate();
      var prevDaysInMonth = new Date(year, month, 0).getDate();

      var today = new Date();
      var html = '';

      /* 上月尾巴（灰显，不可交互重点，仅补齐网格） */
      for (var p = startOffset - 1; p >= 0; p--){
        var pd = prevDaysInMonth - p;
        html += '<div class="cdh-cal-cell outside"><span class="ccc-num">' + pd + '</span></div>';
      }

      for (var d = 1; d <= daysInMonth; d++){
        var key = ymdKey(year, month, d);
        var dateObj = new Date(year, month, d);
        var isToday = isSameYMD(dateObj, today);
        var isFuture = dateObj.setHours(0,0,0,0) > new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
        var holidayName = HOLIDAYS[key];
        var dow = (new Date(year, month, d)).getDay();
        var isWeekend = dow === 0 || dow === 6;

        var info = isFuture ? { hasEntries: false, count: 0 } : generatePlaceholderDayEntries(char, new Date(year, month, d));

        var cls = 'cdh-cal-cell';
        if (isToday) cls += ' is-today';
        if (isWeekend) cls += ' is-weekend';
        if (holidayName) cls += ' is-holiday';
        if (info.hasEntries) cls += ' has-entries';
        if (isFuture) cls += ' is-future';
        if (key === calState.selectedKey) cls += ' is-selected';

        html += '<button type="button" class="' + cls + '" data-date-key="' + key + '" ' + (isFuture ? 'disabled' : '') + '>' +
          '<span class="ccc-num">' + d + '</span>' +
          (holidayName ? '<span class="ccc-holiday">' + holidayName + '</span>' : '') +
          (info.hasEntries ? '<span class="ccc-dots">' + Array(Math.min(info.count, 3)).fill('<i></i>').join('') + '</span>' : '') +
          '</button>';
      }

      var totalCells = startOffset + daysInMonth;
      var nextTail = (7 - (totalCells % 7)) % 7;
      for (var n = 1; n <= nextTail; n++){
        html += '<div class="cdh-cal-cell outside"><span class="ccc-num">' + n + '</span></div>';
      }

      gridEl.innerHTML = html;

      var monthLabel = document.getElementById('cdhCalMonthLabel');
      var yearLabel = document.getElementById('cdhCalYearLabel');
      if (monthLabel) monthLabel.textContent = MONTH_EN[month];
      if (yearLabel) yearLabel.textContent = year + ' · ' + MONTH_CN[month];

      var statMonth = document.getElementById('cdhStatMonth');
      if (statMonth){
        var monthEntryDays = 0;
        for (var dd = 1; dd <= daysInMonth; dd++){
          var dObjx = new Date(year, month, dd);
          if (dObjx.setHours(0,0,0,0) > new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) continue;
          if (generatePlaceholderDayEntries(char, new Date(year, month, dd)).hasEntries) monthEntryDays++;
        }
        statMonth.textContent = pad2(monthEntryDays);
      }
    }

    /* 当前打开的角色，全局唯一入口都读这个引用，避免"先点开角色A，
       再点开角色B"时日历/翻页按钮仍绑定着 A 的闭包，读到旧数据 */
    var currentChar = null;

    function bindCalGridClicks(){
      var gridEl = document.getElementById('cdhCalGrid');
      if (!gridEl) return;
      gridEl.addEventListener('click', function(e){
        if (!currentChar) return;
        var cell = e.target.closest ? e.target.closest('.cdh-cal-cell[data-date-key]') : null;
        if (!cell || cell.disabled) return;
        var key = cell.getAttribute('data-date-key');
        if (window.navigator && window.navigator.vibrate){ try{ window.navigator.vibrate(5); }catch(err){} }

        calState.selectedKey = key;
        gridEl.querySelectorAll('.cdh-cal-cell.is-selected').forEach(function(c){ c.classList.remove('is-selected'); });
        cell.classList.add('is-selected');

        var parts = key.split('-').map(Number);
        var pickedDate = new Date(parts[0], parts[1] - 1, parts[2]);
        updateCalRailLabel(pickedDate);
        /* 选日期不再直接关闭弹窗：底部的「落笔生成 / 前往这一天」仪式条
           需要知道当前选中的是哪一天，由 char-diary.js 接管后续动作 */
        if (window._LunaCharDiaryAI && window._LunaCharDiaryAI.onCalSelect){
          window._LunaCharDiaryAI.onCalSelect(key, currentChar);
        }
      });
    }

    function bindCalNav(){
      var prevBtn = document.getElementById('cdhCalPrev');
      var nextBtn = document.getElementById('cdhCalNext');
      if (prevBtn) prevBtn.addEventListener('click', function(){
        if (!currentChar) return;
        calState.month--;
        if (calState.month < 0){ calState.month = 11; calState.year--; }
        buildCalGrid(currentChar, calState.year, calState.month);
      });
      if (nextBtn) nextBtn.addEventListener('click', function(){
        if (!currentChar) return;
        calState.month++;
        if (calState.month > 11){ calState.month = 0; calState.year++; }
        buildCalGrid(currentChar, calState.year, calState.month);
      });
    }

    /* ============================================================
       日历 · 年月快速跳转面板
       解决"一个月一个月点很难受"的问题：点击顶部月份文字直接唤出
       左侧可滚动年份列 + 右侧 12 个月份网格，一步跳到任意年月
    ============================================================ */
    var CAL_JUMP_YEAR_MIN = 1950; /* 年份下限：覆盖绝大多数出生年份/回忆场景 */
    var CAL_JUMP_YEAR_MAX_AHEAD = 5; /* 上限：当前年之后再留 5 年余量 */

    function buildCalJumpPanel(){
      var yearsEl = document.getElementById('ccjYears');
      var monthsEl = document.getElementById('ccjMonths');
      if (!yearsEl || !monthsEl) return;

      var baseYear = (new Date()).getFullYear();
      var startYear = CAL_JUMP_YEAR_MIN;
      var endYear = baseYear + CAL_JUMP_YEAR_MAX_AHEAD;

      var yHtml = '';
      for (var y = startYear; y <= endYear; y++){
        var cls = 'ccj-year-btn';
        if (y === calState.year) cls += ' is-active';
        if (y === baseYear) cls += ' is-current-year';
        /* 每 5 年加一个刻度标记，长列表里提供视觉锚点，滚动时能一眼估出大致位置 */
        if (y % 5 === 0) cls += ' is-tick';
        yHtml += '<button type="button" class="' + cls + '" data-year="' + y + '">' + y + '</button>';
      }
      yearsEl.innerHTML = yHtml;

      var mHtml = '';
      for (var m = 0; m < 12; m++){
        mHtml += '<button type="button" class="ccj-month-btn' + (m === calState.month ? ' is-active' : '') + '" data-month="' + m + '">' + MONTH_CN[m] + '</button>';
      }
      monthsEl.innerHTML = mHtml;

    }

    /* 把某个年份按钮滚动居中到中央选中带。
       smooth=true 用于用户主动点选后的跟随动画；
       初次打开面板时用 smooth=false，直接跳到位，不需要动画过程。 */
    function centerYearButton(btn, smooth){
      var yearsEl = document.getElementById('ccjYears');
      if (!yearsEl || !btn) return false;
      if (yearsEl.clientHeight === 0) return false;
      var target = btn.offsetTop - (yearsEl.clientHeight / 2) + (btn.clientHeight / 2);
      target = Math.max(0, target);
      if (smooth && 'scrollTo' in yearsEl){
        yearsEl.scrollTo({ top: target, behavior: 'smooth' });
      } else {
        yearsEl.scrollTop = target;
      }
      return true;
    }

    function scrollToActiveYear(){
      var yearsEl = document.getElementById('ccjYears');
      if (!yearsEl) return false;
      var activeYearBtn = yearsEl.querySelector('.ccj-year-btn.is-active');
      if (!activeYearBtn) return false;
      return centerYearButton(activeYearBtn, false);
    }

    function openCalJumpPanel(){
      var panel = document.getElementById('cdhCalJump');
      if (!panel) return;
      buildCalJumpPanel();
      panel.hidden = false;
      requestAnimationFrame(function(){
        panel.classList.add('show');

        /* 面板可见（hidden=false）之后再滚动定位，确保尺寸已经算出来。
           不再赌固定延时够不够：用 ResizeObserver 监听年份列表的实际尺寸变化，
           一旦布局出现（clientHeight 从 0 变为非 0）立刻定位，然后断开观察。
           同时保留几次 rAF/延时兜底，覆盖 ResizeObserver 不可用的极端情况。 */
        var yearsEl = document.getElementById('ccjYears');
        var settled = false;
        function settle(){
          if (settled) return;
          if (scrollToActiveYear()) settled = true;
        }
        if (yearsEl && window.ResizeObserver){
          var ro = new ResizeObserver(function(){
            settle();
            if (settled) ro.disconnect();
          });
          ro.observe(yearsEl);
          /* 面板关闭或重新打开时最多观察 1s，避免观察者悬空常驻 */
          setTimeout(function(){ ro.disconnect(); }, 1000);
        }
        requestAnimationFrame(function(){
          settle();
          setTimeout(settle, 60);
          setTimeout(settle, 220);
        });
      });
    }

    function closeCalJumpPanel(){
      var panel = document.getElementById('cdhCalJump');
      if (!panel) return;
      panel.classList.remove('show');
      setTimeout(function(){ panel.hidden = true; }, 280);
    }

    function bindCalJumpPanel(){
      var headBtn = document.getElementById('cdhCalHeadJump');
      var panel = document.getElementById('cdhCalJump');
      var yearsEl = document.getElementById('ccjYears');
      var monthsEl = document.getElementById('ccjMonths');
      var todayBtn = document.getElementById('ccjTodayBtn');
      if (!headBtn || !panel) return;

      headBtn.addEventListener('click', function(){
        if (!currentChar) return;
        if (panel.classList.contains('show')) closeCalJumpPanel();
        else openCalJumpPanel();
      });

      if (yearsEl){
        yearsEl.addEventListener('click', function(e){
          var btn = e.target.closest ? e.target.closest('.ccj-year-btn') : null;
          if (!btn || !currentChar) return;
          calState.year = parseInt(btn.getAttribute('data-year'), 10);
          buildCalGrid(currentChar, calState.year, calState.month);
          yearsEl.querySelectorAll('.ccj-year-btn').forEach(function(b){ b.classList.toggle('is-active', b === btn); });
          /* 点选后把这一年平滑滚回中央选中带，而不是留在原地——
             否则会出现"选中了但胶囊/位置不跟着走"的观感 */
          centerYearButton(btn, true);
          if (window.navigator && window.navigator.vibrate){ try{ window.navigator.vibrate(4); }catch(err){} }
        });
      }
      if (monthsEl){
        monthsEl.addEventListener('click', function(e){
          var btn = e.target.closest ? e.target.closest('.ccj-month-btn') : null;
          if (!btn || !currentChar) return;
          calState.month = parseInt(btn.getAttribute('data-month'), 10);
          buildCalGrid(currentChar, calState.year, calState.month);
          monthsEl.querySelectorAll('.ccj-month-btn').forEach(function(b){ b.classList.toggle('is-active', b === btn); });
          if (window.navigator && window.navigator.vibrate){ try{ window.navigator.vibrate(4); }catch(err){} }
          closeCalJumpPanel();
        });
      }
      if (todayBtn){
        todayBtn.addEventListener('click', function(){
          if (!currentChar) return;
          var today = new Date();
          calState.year = today.getFullYear();
          calState.month = today.getMonth();
          buildCalGrid(currentChar, calState.year, calState.month);
          closeCalJumpPanel();
        });
      }
    }

    /* ============================================================
       日历弹窗（居中卡片式）开关 —— 取代原折叠面板的展开/收起
    ============================================================ */
    function openCalModal(){
      var veil = document.getElementById('cdhCalVeil');
      var modal = document.getElementById('cdhCalModal');
      if (!veil || !modal) return;
      veil.classList.add('show');
      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
    }
    function closeCalModal(){
      var veil = document.getElementById('cdhCalVeil');
      var modal = document.getElementById('cdhCalModal');
      if (!veil || !modal) return;
      /* 关闭前先把焦点移出容器，避免"隐藏一个仍被聚焦的元素"的无障碍警告 */
      var active = document.activeElement;
      if (active && modal.contains(active)) active.blur();
      veil.classList.remove('show');
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
      var jumpPanel = document.getElementById('cdhCalJump');
      if (jumpPanel && jumpPanel.classList.contains('show')){
        jumpPanel.classList.remove('show');
        setTimeout(function(){ jumpPanel.hidden = true; }, 280);
      }
    }
    /* 入口条上的铭文，随当前选中日期同步更新 */
    function updateCalRailLabel(dateObj){
      var labelEl = document.getElementById('cdhCalRailLabel');
      if (!labelEl) return;
      if (!dateObj){ labelEl.textContent = '选择一个日子'; return; }
      labelEl.textContent = MONTH_CN[dateObj.getMonth()] + dateObj.getDate() + '日 · ' + WEEKDAY_CN[dateObj.getDay()];
    }

    /* ============================================================
       时间轴渲染
    ============================================================ */

    /* ------------------------------------------------------------------
       时间轴卡片 —— 结构重做
       旧版把标题/摘要/页脚全部塞进 .cdh-card-inner，而拍立得版式又把
       .cdh-card-inner 当成固定比例的相纸窗口，于是所有文字被挤压在一个
       小色块里（正是截图里"挤在一起"的成因）。
       新结构把"物理层"与"文字层"彻底分开：
         .cdh-card-stack  —— 身后压着的第二张纸（纯装饰）
         .cdh-card-tape   —— 半透明胶带（拍立得 / 便签）
         .cdh-card-plate  —— 相纸窗 / 信笺纹样（只有需要的版式才出现）
         .cdh-card-inner  —— 唯一承载文字的层，永远自适应高度
    ------------------------------------------------------------------ */
    function buildEntryCardHtml(entry, dayMeta, dateKey, charId){
      var s = shared();
      var moodLabel = MOOD_LABEL[entry.mood] || '平静';
      var escT = s.escHtml ? s.escHtml(entry.title) : entry.title;
      var escE = s.escHtml ? s.escHtml(entry.excerpt) : entry.excerpt;
      var style = entry.style || CARD_STYLES[0];

      var place = entry.place ? (s.escHtml ? s.escHtml(entry.place) : entry.place) : '';
      var weather = entry.weather ? (s.escHtml ? s.escHtml(entry.weather) : entry.weather) : '';
      var sign = entry.signature ? (s.escHtml ? s.escHtml(entry.signature) : entry.signature) : '';

      /* 相纸窗：只有拍立得需要。窗内不放文字，只有一层柔光与一枚极简徽记，
         真正的文字全部落在窗下方的宽白边上，还原真实拍立得的比例关系 */
      var plate = '';
      if (style === 'polaroid'){
        plate =
          '<span class="cdh-card-plate" aria-hidden="true">' +
            '<span class="ccp-light"></span>' +
            '<span class="ccp-grain"></span>' +
            '<span class="ccp-mark"><svg viewBox="0 0 24 24" fill="none">' +
              '<circle cx="12" cy="12" r="7.2" stroke="currentColor" stroke-width="0.9" stroke-dasharray="0.8 3.4"/>' +
              '<path d="M12 6.4c1.7 2.1 2.8 3.7 2.8 5.4a2.8 2.8 0 1 1-5.6 0c0-1.7 1.1-3.3 2.8-5.4Z" fill="currentColor" opacity="0.55"/>' +
            '</svg></span>' +
          '</span>';
      }
      if (style === 'wax-letter'){
        plate = '<span class="cdh-card-plate cdh-card-plate--letter" aria-hidden="true"></span>';
      }

      var tape = (style === 'polaroid' || style === 'notestrip')
        ? '<span class="cdh-card-tape" aria-hidden="true"></span>' : '';
      var headBar = style === 'notestrip' ? '<span class="cdh-card-head" aria-hidden="true"></span>' : '';
      var waxSeal = style === 'wax-letter'
        ? '<span class="wax-seal" aria-hidden="true"><i></i></span>' : '';

      /* 元信息胶囊：天气 / 地点 —— 有才出现，没有就完全不占位 */
      var chips = '';
      if (weather) chips += '<span class="cdh-card-chip">' + weather + '</span>';
      if (place)   chips += '<span class="cdh-card-chip cdh-card-chip--place">' + place + '</span>';

      return (
        '<button type="button" class="cdh-card cdh-card--' + style + '" data-mood="' + entry.mood + '"' +
          ' data-entry-id="' + (entry.id || '') + '" data-date-key="' + (dateKey || '') + '"' +
          ' data-char-id="' + (charId == null ? '' : charId) + '">' +
          '<span class="cdh-card-stack" aria-hidden="true"></span>' +
          waxSeal +
          tape +
          headBar +
          plate +
          '<span class="cdh-card-inner">' +
            '<span class="cdh-card-topline">' +
              '<span class="cdh-card-mood" data-mood="' + entry.mood + '"><em>' + moodLabel + '</em></span>' +
              '<span class="cdh-card-time">' + (entry.time || '') + '</span>' +
            '</span>' +
            '<span class="cdh-card-title">' + escT + '</span>' +
            '<span class="cdh-card-excerpt">' + escE + '</span>' +
            (chips ? '<span class="cdh-card-chips">' + chips + '</span>' : '') +
            (sign ? '<span class="cdh-card-sign">' + sign + '</span>' : '') +
            '<span class="cdh-card-footline">' +
              '<span class="cdh-card-wc">' + (entry.wordCount || 0) + ' 字</span>' +
              '<span class="cdh-card-tap">轻触阅读全文<i></i></span>' +
            '</span>' +
          '</span>' +
        '</button>'
      );
    }

    function buildDayNodeHtml(char, dateObj){
      var y = dateObj.getFullYear(), m = dateObj.getMonth(), d = dateObj.getDate();
      var key = ymdKey(y, m, d);
      var info = generatePlaceholderDayEntries(char, dateObj);
      var today = new Date();
      var isToday = isSameYMD(dateObj, today);
      var holidayName = HOLIDAYS[key];

      var headHtml =
        '<div class="cdh-tl-node" data-date-key="' + key + '">' +
          '<div class="cdh-tl-axis">' +
            '<span class="cdh-tl-dot' + (info.hasEntries ? ' is-lit' : '') + (isToday ? ' is-today' : '') + '"></span>' +
            '<span class="cdh-tl-line"></span>' +
          '</div>' +
          '<div class="cdh-tl-content">' +
            '<div class="cdh-tl-daymark' + (isToday ? ' is-today' : '') + '">' +
              '<span class="cdh-tl-daynum">' + pad2(d) + '</span>' +
              '<span class="cdh-tl-daymeta">' +
                '<span>' + MONTH_CN[m] + ' · ' + WEEKDAY_CN[dateObj.getDay()] + '</span>' +
                (holidayName ? '<span class="cdh-tl-holiday">' + holidayName + '</span>' : '') +
                (isToday ? '<span class="cdh-tl-todaytag">今日</span>' : '') +
              '</span>' +
            '</div>' +
            (info.hasEntries
              ? '<div class="cdh-tl-cards">' + info.entries.map(function(en){ return buildEntryCardHtml(en, info, key, char && char.id); }).join('') + '</div>'
              : '<div class="cdh-tl-blank">' + (info.future ? '这一天尚未到来' : '这一天，没有落笔') + '</div>'
            ) +
          '</div>' +
        '</div>';

      return headHtml;
    }

    /* 时间轴默认展示"今日往前 21 天"的窗口，点击日历某天后会插入/滚动到
       对应节点；若该天不在当前窗口内，则以该天为终点重新铺设窗口 */
    var tlState = { anchorEnd: null, span: 21, char: null };

    /* 空态卡片：尚无任何日记时，不再堆叠"没有落笔"的空行，
       改为一枚安静的仪式提示。窗口内只要出现一天有内容就退出空态。 */
    function emptyTimelineHtml(){
      return '<div class="cdh-tl-empty">' +
        '<div class="cdh-tl-empty-mark">' +
          '<svg viewBox="0 0 24 24" fill="none"><path d="M5 19 L5.7 15.9C5.8 15.4 6.05 14.95 6.4 14.6 L15.3 5.7C16.1 4.9 17.4 4.9 18.2 5.7L18.3 5.8C19.1 6.6 19.1 7.9 18.3 8.7L9.4 17.6C9.05 17.95 8.6 18.2 8.1 18.3Z"/></svg>' +
        '</div>' +
        '<div class="cdh-tl-empty-title">这本日记还是空的</div>' +
        '<div class="cdh-tl-empty-sub">尚未有任何落笔。写下第一篇后，时光会在这里被一页页记住。</div>' +
      '</div>';
    }

    /* 折叠空白日的连接段：把连续 N 天「没有落笔」合并成一条细线上的
       小标签，而不是把每一天都铺成一整块独立行——这样时间轴上能看到
       的，永远只有「今天」和真正写过的日子，不会被一堆空日期挤在一起。 */
    function buildGapHtml(startDate, dayCount){
      if (dayCount <= 0) return '';
      var label = dayCount === 1
        ? fmtGapDate(startDate) + ' · 没有落笔'
        : fmtGapDate(startDate) + ' 起，' + dayCount + ' 天没有落笔';
      return (
        '<div class="cdh-tl-gap">' +
          '<span class="cdh-tl-gap-line"></span>' +
          '<span class="cdh-tl-gap-text">' + label + '</span>' +
          '<span class="cdh-tl-gap-line"></span>' +
        '</div>'
      );
    }
    function fmtGapDate(d){ return MONTH_CN[d.getMonth()] + pad2(d.getDate()) + '日'; }

    function renderTimelineWindow(char, endDate){
      var tlEl = document.getElementById('cdhTimeline');
      var endMark = document.getElementById('cdhTimelineEnd');
      if (!tlEl) return;
      tlState.char = char;
      tlState.anchorEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

      var today = new Date(); today.setHours(0,0,0,0);
      var html = '';
      var anyEntries = false;

      for (var i = 0; i < tlState.span; i++){
        var d = new Date(tlState.anchorEnd);
        d.setDate(d.getDate() - i);
        var info = generatePlaceholderDayEntries(char, d);
        var isToday = isSameYMD(d, today);

        if (info.hasEntries){
          anyEntries = true;
          html += buildDayNodeHtml(char, d);
        }else if (isToday){
          /* 只有「今天」在没有落笔时也始终显示，作为"当下"的锚点；
             其余没有落笔的日期一律不出现在时间轴上——不再堆叠
             "没有落笔"的空行，也不再折叠成占位的间隔标签，
             时间轴上只留下真正写过的日子和今天。 */
          html += buildDayNodeHtml(char, d);
        }
        /* 其余没有落笔、且不是今天的日期：完全跳过，不渲染任何节点 */
      }

      if (!anyEntries){
        tlEl.innerHTML = emptyTimelineHtml();
        if (endMark) endMark.style.display = 'none';
      }else{
        tlEl.innerHTML = html;
        if (endMark) endMark.style.display = '';
      }
    }

    function jumpTimelineToDate(char, dateObj){
      var key = ymdKey(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
      var existing = document.querySelector('.cdh-tl-node[data-date-key="' + key + '"]');
      if (!existing){
        renderTimelineWindow(char, dateObj);
        existing = document.querySelector('.cdh-tl-node[data-date-key="' + key + '"]');
      }
      if (existing){
        existing.classList.add('cdh-tl-node--flash');
        setTimeout(function(){ existing.classList.remove('cdh-tl-node--flash'); }, 1400);
        existing.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      /* 若该天没有落笔，时间轴上不会渲染出对应节点（空日期一律隐藏）——
         这种情况下窗口已经以该天为终点重新铺设，只是没有可高亮的节点，
         无需额外提示，日历面板本身已用"有无落笔"的圆点区分过 */
    }

    /* 时间轴滚动到底部时，自动向更早的日期扩展窗口（无限回溯） */
    function bindTimelineInfiniteScroll(){
      var scrollEl = document.getElementById('cdhScroll');
      if (!scrollEl) return;
      var loading = false;
      scrollEl.addEventListener('scroll', function(){
        if (loading || !tlState.char) return;
        var remaining = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
        if (remaining < 480){
          loading = true;
          var tlEl = document.getElementById('cdhTimeline');
          var extendFrom = new Date(tlState.anchorEnd);
          extendFrom.setDate(extendFrom.getDate() - tlState.span);
          var extra = '';
          for (var i = 0; i < 14; i++){
            var d = new Date(extendFrom);
            d.setDate(d.getDate() - i);
            var info = generatePlaceholderDayEntries(tlState.char, d);
            /* 与主渲染逻辑保持一致：没有落笔的日期不追加节点，只保留真正写过的日子 */
            if (info.hasEntries) extra += buildDayNodeHtml(tlState.char, d);
          }
          if (tlEl && extra) tlEl.insertAdjacentHTML('beforeend', extra);
          tlState.span += 14;
          setTimeout(function(){ loading = false; }, 200);
        }
      }, { passive: true });
    }

    /* 时间轴上的任意一张日记卡片 → 打开 char 日记详情页 */
    function bindTimelineCardClicks(){
      var tlEl = document.getElementById('cdhTimeline');
      if (!tlEl) return;
      tlEl.addEventListener('click', function(e){
        var card = e.target.closest ? e.target.closest('.cdh-card[data-entry-id]') : null;
        if (!card) return;
        if (window.navigator && window.navigator.vibrate){ try{ window.navigator.vibrate(6); }catch(err){} }
        if (window.openCharEntryDetail){
          window.openCharEntryDetail(card.getAttribute('data-char-id'), card.getAttribute('data-date-key'), card.getAttribute('data-entry-id'));
        }
      });
    }

    /* ============================================================
       Hero 渲染：角色主题化头部
    ============================================================ */
    function renderHero(char, skin){
      var s = shared();
      var meta = (s.SKIN_META || {})[skin] || { plate: '雾蔷笺', sub: 'ROSE MIST FOLIO' };
      var emblem = (s.EMBLEM_SVGS || {})[skin] || '';

      var avatarEl = document.getElementById('cdhHeroAvatar');
      if (avatarEl) avatarEl.innerHTML = s.renderCharAvatar ? s.renderCharAvatar(char) : '';

      var nameEl = document.getElementById('cdhHeroName');
      if (nameEl) nameEl.textContent = char.name || '未命名';

      var roleEl = document.getElementById('cdhHeroRole');
      var role = (char.relation || char.role || '未署名的角色').trim();
      if (roleEl) roleEl.textContent = role;

      var plateEl = document.getElementById('cdhHeroPlateTitle');
      if (plateEl) plateEl.textContent = '「' + meta.plate + '」 · ' + meta.sub;

      var emblemEl = document.getElementById('cdhHeroEmblem');
      if (emblemEl) emblemEl.innerHTML = emblem;

      var topbarLabel = document.getElementById('cdhTopbarLabel');
      if (topbarLabel) topbarLabel.textContent = (char.name || 'Ta') + ' 的日记';

      var statTotal = document.getElementById('cdhStatTotal');
      if (statTotal){
        var traits = (char.traits || []).filter(Boolean);
        var sensitivity = traits.some(function(t){ return /敏感|细腻|多愁/.test(t); }) ? '强烈' :
          traits.some(function(t){ return /冷|淡|克制|疏离/.test(t); }) ? '克制' : '鲜明';
        statTotal.textContent = sensitivity;
      }

      /* 页面根节点挂载 skin class，供 CSS 联动切换整页主题色 */
      var page = document.getElementById('cdhPage');
      if (page){
        (s.BOOK_SKINS || []).forEach(function(sk){ page.classList.remove(sk); });
        page.classList.add(skin);
      }
    }

    /* ============================================================
       打开 / 关闭 专属主页
    ============================================================ */
    var cdhVeil, cdhPage, cdhScroll, cdhBackBtn, cdhCalBtn, cdhCalRail;
    var cdhCalCloseBtn, cdhCalModalVeil;
    var _boundOnce = false;

    function ensureRefs(){
      cdhVeil = document.getElementById('cdhVeil');
      cdhPage = document.getElementById('cdhPage');
      cdhScroll = document.getElementById('cdhScroll');
      cdhBackBtn = document.getElementById('cdhBackBtn');
      cdhCalBtn = document.getElementById('cdhCalBtn');
      cdhCalRail = document.getElementById('cdhCalRail');
      cdhCalCloseBtn = document.getElementById('cdhCalCloseBtn');
      cdhCalModalVeil = document.getElementById('cdhCalVeil');
    }

    window.openCharDiaryHome = function(char, skin){
      ensureRefs();
      if (!cdhPage || !cdhVeil) return;

      currentChar = char;

      var today = new Date();
      calState.year = today.getFullYear();
      calState.month = today.getMonth();
      calState.selectedKey = ymdKey(today.getFullYear(), today.getMonth(), today.getDate());

      renderHero(char, skin);
      buildCalGrid(char, calState.year, calState.month);
      renderTimelineWindow(char, today);
      updateCalRailLabel(null);
      closeCalModal();
      if (cdhPage) cdhPage.setAttribute('data-current-char-id', char.id);
      if (window._LunaCharBg && window._LunaCharBg.applyToHome) window._LunaCharBg.applyToHome(char);

      if (!_boundOnce){
        bindCalGridClicks();
        bindCalNav();
        bindCalJumpPanel();
        bindTimelineInfiniteScroll();
        bindTimelineCardClicks();
        _boundOnce = true;
      }

      cdhVeil.classList.add('show');
      cdhPage.classList.add('show');
      cdhPage.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      if (cdhScroll) cdhScroll.scrollTop = 0;

      /* 把该角色已生成的日记读进内存缓存，回来后重刷日历与时间轴 */
      if (window._LunaCharDiaryAI && window._LunaCharDiaryAI.preload){
        window._LunaCharDiaryAI.preload(char.id).then(function(){ refreshCharDiaryViews(); });
      }
    };

    /* 供 char-diary.js 在生成完成后调用：整页数据重刷（日历标点 + 时间轴 + 统计） */
    function refreshCharDiaryViews(keepDate){
      if (!currentChar) return;
      buildCalGrid(currentChar, calState.year, calState.month);
      var endDate = keepDate || (tlState.anchorEnd ? new Date(tlState.anchorEnd) : new Date());
      renderTimelineWindow(currentChar, endDate);
    }

    window._LunaCharDiaryHooks = {
      refresh: refreshCharDiaryViews,
      jumpToDate: function(dateObj){ if (currentChar) jumpTimelineToDate(currentChar, dateObj); },
      closeCalModal: closeCalModal,
      getChar: function(){ return currentChar; },
      getHoliday: function(key){ return HOLIDAYS[key] || ''; },
      getSelectedKey: function(){ return calState.selectedKey; },
      weekdayCN: function(i){ return WEEKDAY_CN[i]; },
      monthCN: function(i){ return MONTH_CN[i]; },
      monthEN: function(i){ return MONTH_EN[i]; },
      moodGlyph: MOOD_GLYPH,
      moodLabel: MOOD_LABEL,
      cardStyles: CARD_STYLES
    };

    function closeCharDiaryHome(){
      if (!cdhPage || !cdhVeil) return;
      var active = document.activeElement;
      if (active && cdhPage.contains(active)) active.blur();
      cdhVeil.classList.remove('show');
      cdhPage.classList.remove('show');
      cdhPage.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      currentChar = null;
    }

    document.addEventListener('DOMContentLoaded', function(){
      ensureRefs();
      if (cdhBackBtn){
        cdhBackBtn.addEventListener('click', function(){
          if (window.navigator && window.navigator.vibrate){ try{ window.navigator.vibrate(5); }catch(e){} }
          closeCharDiaryHome();
        });
      }
      if (cdhVeil) cdhVeil.addEventListener('click', closeCharDiaryHome);

      /* 顶部工具条日历图标 与 时间轴上方的"翻阅时光"入口条，
         二者共用同一个居中卡片式弹窗 */
      if (cdhCalBtn) cdhCalBtn.addEventListener('click', openCalModal);
      if (cdhCalRail) cdhCalRail.addEventListener('click', openCalModal);
      if (cdhCalCloseBtn) cdhCalCloseBtn.addEventListener('click', closeCalModal);
      if (cdhCalModalVeil) cdhCalModalVeil.addEventListener('click', closeCalModal);
    });

  })();

  /* ================================================================
     Part F —— Char 日记 · 背景设置（纯色 / 图片）
     数据独立存储于本机 IndexedDB「LunaDiaryBgDB / bgSettings」，以
     角色 id 为主键：{ charId, mode: 'theme'|'color'|'image', value }
     value 在 mode=color 时为任意合法 CSS 颜色字符串；
     mode=image 时为图片的 data URL（不压缩，原图存储）。
     保存后同步两处渲染：
       1) 专属主页 .cdh-page 根节点（挂载 custom-bg-color/-image class）
       2) 书架封面 .char-book（挂载同名 class，供 diary.css 联动生效）
  ================================================================ */
  (function(){

    var DB_NAME = 'LunaDiaryBgDB';
    var STORE_NAME = 'bgSettings';

    function openBgDB(){
      return new Promise(function(resolve, reject){
        try{
          var req = indexedDB.open(DB_NAME, 1);
          req.onupgradeneeded = function(e){
            var db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)){
              db.createObjectStore(STORE_NAME, { keyPath: 'charId' });
            }
          };
          req.onsuccess = function(e){ resolve(e.target.result); };
          req.onerror = function(e){ reject(e); };
        }catch(err){ reject(err); }
      });
    }

    function getBgSetting(charId){
      return openBgDB().then(function(db){
        return new Promise(function(resolve){
          try{
            var tx = db.transaction(STORE_NAME, 'readonly');
            var req = tx.objectStore(STORE_NAME).get(String(charId));
            req.onsuccess = function(){ resolve(req.result || null); };
            req.onerror = function(){ resolve(null); };
          }catch(err){ resolve(null); }
        });
      }).catch(function(){ return null; });
    }

    function saveBgSetting(charId, mode, value, contrastPref){
      return openBgDB().then(function(db){
        return new Promise(function(resolve, reject){
          try{
            var tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put({ charId: String(charId), mode: mode, value: value || '', contrastPref: contrastPref || 'auto', updatedAt: Date.now() });
            tx.oncomplete = function(){ resolve(true); };
            tx.onerror = function(e){ reject(e); };
          }catch(err){ reject(err); }
        });
      });
    }

    function deleteBgSetting(charId){
      return openBgDB().then(function(db){
        return new Promise(function(resolve){
          try{
            var tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(String(charId));
            tx.oncomplete = function(){ resolve(true); };
            tx.onerror = function(){ resolve(false); };
          }catch(err){ resolve(false); }
        });
      });
    }

    /* 预设色板：取自六套版型的 accent-soft 主题色，方便快速取色 */
    var PRESET_SWATCHES = ['#c9bfe0', '#e3c9d1', '#c7c9cf', '#e7dbb8', '#a89bcf', '#a4c9ba'];

    /* ---- 将某个设置应用到指定 DOM 节点（专属主页根节点 或 书架书本节点） ---- */
    function applySettingToNode(node, setting, isBookCover){
      if (!node) return;
      var colorClass = isBookCover ? 'custom-bg-color' : 'custom-bg-color';
      var imageClass = isBookCover ? 'custom-bg-image' : 'custom-bg-image';
      node.classList.remove(colorClass, imageClass);
      if (isBookCover){
        node.style.removeProperty('--ccb-custom-bg');
        node.style.removeProperty('--ccb-custom-bg-img');
      }else{
        node.style.removeProperty('--cdh-custom-bg');
        node.style.removeProperty('--cdh-custom-bg-img');
      }

      if (!setting || setting.mode === 'theme' || !setting.value) return;

      if (setting.mode === 'color'){
        node.classList.add(colorClass);
        node.style.setProperty(isBookCover ? '--ccb-custom-bg' : '--cdh-custom-bg', setting.value);
      }else if (setting.mode === 'image'){
        node.classList.add(imageClass);
        /* data URL 本身不含双引号，直接用引号包裹拼成 url("...") 即可 */
        node.style.setProperty(isBookCover ? '--ccb-custom-bg-img' : '--cdh-custom-bg-img', 'url("' + setting.value + '")');
      }
    }

    /* ============================================================
       ★ 自适应文字明暗（Auto Contrast） ★
       用户选择自定义纯色/图片背景后，原皮肤预设的墨色文字未必仍然可读
       （比如深色照片配深色文字）。这里实测背景的相对亮度，自动在
       .cdh-page 上挂载 on-dark / on-light，切换 --cdh-ink 等变量。
       纯色背景：直接用探针 canvas 解析出的 RGB 算亮度；
       图片背景：把图片画到一个小 canvas 上，采样中心区域像素求平均亮度。
       用户仍可在设置弹窗里手动挑选任意颜色，本函数只负责"文字自动跟随
       背景明暗切换"，不会覆盖用户对背景颜色本身的选择。
    ============================================================ */
    function relativeLuminance(r, g, b){
      function lin(c){ c/=255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); }
      return 0.2126*lin(r) + 0.7152*lin(g) + 0.0722*lin(b);
    }

    function setContrastClass(page, isDark){
      if (!page) return;
      page.classList.remove('on-dark', 'on-light');
      if (isDark === true) page.classList.add('on-dark');
      else if (isDark === false) page.classList.add('on-light');
      /* isDark === null：清除覆盖，沿用皮肤预设的默认文字色 */
    }

    /* contrastPref：用户在设置弹窗里手动选择的策略
         'auto'（默认）→ 实测背景亮度自动判断，走下方原有逻辑
         'light'       → 强制走浅色文字（对应 on-dark，白字）
         'dark'        → 强制走深色文字（对应 on-light，黑字）
       仅在 mode 为 color/image（自定义背景）时才有意义；mode=theme 时
       始终清除覆盖，沿用当前皮肤预设的文字色。 */
    function applyAutoContrast(page, mode, value, contrastPref){
      if (!page) return;
      if (mode === 'theme' || !value){
        setContrastClass(page, null);
        return;
      }
      if (contrastPref === 'light'){ setContrastClass(page, true); return; }
      if (contrastPref === 'dark'){ setContrastClass(page, false); return; }
      /* 'auto' 或未指定：沿用实测亮度判断 */
      if (mode === 'color'){
        var probe = document.createElement('canvas');
        probe.width = 1; probe.height = 1;
        var pctx = probe.getContext('2d', { willReadFrequently: true });
        try{
          pctx.fillStyle = value;
          pctx.fillRect(0,0,1,1);
          var d = pctx.getImageData(0,0,1,1).data;
          var lum = relativeLuminance(d[0], d[1], d[2]);
          setContrastClass(page, lum < 0.42);
        }catch(e){ setContrastClass(page, null); }
        return;
      }
      if (mode === 'image'){
        var img = new Image();
        img.onload = function(){
          try{
            var sw = 40, sh = 40;
            var c = document.createElement('canvas');
            c.width = sw; c.height = sh;
            var cx = c.getContext('2d', { willReadFrequently: true });
            cx.drawImage(img, 0, 0, sw, sh);
            var data = cx.getImageData(0, 0, sw, sh).data;
            var total = 0, count = 0;
            for (var i = 0; i < data.length; i += 4){
              total += relativeLuminance(data[i], data[i+1], data[i+2]);
              count++;
            }
            var avg = count ? total / count : 0.6;
            setContrastClass(page, avg < 0.42);
          }catch(e){ setContrastClass(page, null); }
        };
        img.onerror = function(){ setContrastClass(page, null); };
        img.src = value;
      }
    }

    /* 专属主页打开时调用：读取该角色的背景设置并应用到 .cdh-page */
    function applyToHome(char){
      var page = document.getElementById('cdhPage');
      if (!page || !char) return;
      getBgSetting(char.id).then(function(setting){
        applySettingToNode(page, setting, false);
        applyAutoContrast(page, (setting && setting.mode) || 'theme', setting && setting.value, setting && setting.contrastPref);
        _currentSetting = setting;
      });
    }

    /* 书架渲染完成后调用：为每一本书应用其角色的背景设置 */
    function applyToShelf(){
      var shelf = document.getElementById('charShelf');
      if (!shelf) return;
      var books = shelf.querySelectorAll('.char-book[data-char-id]');
      books.forEach(function(book){
        var charId = book.getAttribute('data-char-id');
        getBgSetting(charId).then(function(setting){
          applySettingToNode(book, setting, true);
        });
      });
    }
    window._LunaCharBg = { applyToHome: applyToHome, applyToShelf: applyToShelf };

    /* ---- 背景设置弹窗交互 ---- */
    var _currentSetting = null; /* { mode, value, contrastPref } 或 null（沿用默认主题）*/
    var _pendingImageDataUrl = '';
    var _activeMode = 'theme';
    var _contrastPref = 'auto'; /* 'auto' | 'light' | 'dark' —— 页面文字明暗策略 */

    function getCurrentChar(){
      /* Part E 的 currentChar 变量是模块私有的，这里通过打开时挂在
         cdhPage 上的 data-char-id 反查，避免跨模块暴露过多内部状态 */
      var page = document.getElementById('cdhPage');
      return page ? page.getAttribute('data-current-char-id') : null;
    }

    /* ============================================================
       ★ 全自绘颜色选择器引擎（拒绝浏览器原生 input[type=color]） ★
       内部状态统一用 HSV + alpha 表示，与文本框（hex/rgba）双向同步：
         - 拖动饱和度/明度面板 → 改 S/V
         - 拖动色相滑条 → 改 H
         - 拖动透明度滑条 → 改 A
         - 手动输入文本框 → 反解析出 H/S/V/A，回填三个滑控件
    ============================================================ */
    var ColorPicker = (function(){
      var state = { h: 340, s: 35, v: 90, a: 1 }; // 默认对应 #e3c9d1 附近色调
      var dragging = null;

      function hsvToRgb(h, s, v){
        s /= 100; v /= 100;
        var c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
        var r=0,g=0,b=0;
        if (h < 60){ r=c; g=x; b=0; }
        else if (h < 120){ r=x; g=c; b=0; }
        else if (h < 180){ r=0; g=c; b=x; }
        else if (h < 240){ r=0; g=x; b=c; }
        else if (h < 300){ r=x; g=0; b=c; }
        else { r=c; g=0; b=x; }
        return { r: Math.round((r+m)*255), g: Math.round((g+m)*255), b: Math.round((b+m)*255) };
      }
      function rgbToHsv(r, g, b){
        r/=255; g/=255; b/=255;
        var max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
        var h=0, s = max===0?0:d/max, v=max;
        if (d !== 0){
          if (max===r) h = 60*(((g-b)/d)%6);
          else if (max===g) h = 60*((b-r)/d+2);
          else h = 60*((r-g)/d+4);
        }
        if (h < 0) h += 360;
        return { h: h, s: s*100, v: v*100 };
      }
      function toHex2(n){ var s = n.toString(16); return s.length===1 ? '0'+s : s; }

      function currentRgb(){ return hsvToRgb(state.h, state.s, state.v); }
      function currentHex(){
        var rgb = currentRgb();
        return '#' + toHex2(rgb.r) + toHex2(rgb.g) + toHex2(rgb.b);
      }
      function currentCss(){
        var rgb = currentRgb();
        if (state.a >= 1) return currentHex();
        return 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + (Math.round(state.a*100)/100) + ')';
      }

      /* 解析任意合法颜色字符串（#hex / rgb / rgba / 具名色）为 h/s/v/a，
         借助浏览器自身的颜色解析能力（一个隐藏 canvas 探针），
         而不是重新实现一遍 CSS 颜色语法 */
      var probeCanvas = null, probeCtx = null;
      function parseAnyColor(str){
        if (!str) return null;
        if (!probeCanvas){ probeCanvas = document.createElement('canvas'); probeCanvas.width = 1; probeCanvas.height = 1; probeCtx = probeCanvas.getContext('2d', { willReadFrequently: true }); }
        try{
          probeCtx.clearRect(0,0,1,1);
          probeCtx.fillStyle = '#000';
          probeCtx.fillStyle = str;
          var computed = probeCtx.fillStyle; // 归一化为 #rrggbb 或 rgba(...)
          probeCtx.fillRect(0,0,1,1);
          var data = probeCtx.getImageData(0,0,1,1).data;
          var alpha = 1;
          var m = /rgba?\(([^)]+)\)/.exec(str);
          if (m){
            var parts = m[1].split(',').map(function(p){ return parseFloat(p); });
            if (parts.length === 4) alpha = parts[3];
          }
          var hsv = rgbToHsv(data[0], data[1], data[2]);
          return { h: hsv.h, s: hsv.s, v: hsv.v, a: alpha };
        }catch(e){ return null; }
      }

      function setFromString(str, opts){
        var parsed = parseAnyColor(str);
        if (!parsed) return false;
        state.h = parsed.h; state.s = parsed.s; state.v = parsed.v; state.a = parsed.a;
        render(opts);
        return true;
      }

      function setHsva(h, s, v, a, opts){
        if (h != null) state.h = ((h % 360) + 360) % 360;
        if (s != null) state.s = Math.max(0, Math.min(100, s));
        if (v != null) state.v = Math.max(0, Math.min(100, v));
        if (a != null) state.a = Math.max(0, Math.min(1, a));
        render(opts);
      }

      var canvas, ctx, thumb, hueTrack, hueThumb, alphaTrack, alphaThumb, previewChip, textInput;
      var onChangeCb = null;

      function paintCanvas(){
        if (!ctx) return;
        var w = canvas.width, h = canvas.height;
        var hueRgb = hsvToRgb(state.h, 100, 100);
        ctx.fillStyle = 'rgb(' + hueRgb.r + ',' + hueRgb.g + ',' + hueRgb.b + ')';
        ctx.fillRect(0, 0, w, h);
        var satGrad = ctx.createLinearGradient(0, 0, w, 0);
        satGrad.addColorStop(0, 'rgba(255,255,255,1)');
        satGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = satGrad;
        ctx.fillRect(0, 0, w, h);
        var valGrad = ctx.createLinearGradient(0, 0, 0, h);
        valGrad.addColorStop(0, 'rgba(0,0,0,0)');
        valGrad.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.fillStyle = valGrad;
        ctx.fillRect(0, 0, w, h);
      }

      function render(opts){
        opts = opts || {};
        if (canvas && (!opts.skipCanvasPaint)) paintCanvas();
        if (thumb && canvas){
          var x = (state.s / 100) * canvas.clientWidth;
          var y = (1 - state.v / 100) * canvas.clientHeight;
          thumb.style.left = x + 'px';
          thumb.style.top = y + 'px';
        }
        if (hueThumb && hueTrack){
          hueThumb.style.left = (state.h / 360 * 100) + '%';
        }
        if (alphaThumb && alphaTrack){
          alphaThumb.style.left = (state.a * 100) + '%';
        }
        if (alphaTrack){
          alphaTrack.style.setProperty('--ccp-current-opaque', currentHex());
        }
        if (previewChip){
          previewChip.style.setProperty('--ccp-current', currentCss());
        }
        if (textInput && !opts.skipText){
          textInput.value = currentCss();
        }
        if (onChangeCb && !opts.silent) onChangeCb(currentCss());
      }

      function pointFromEvent(e, el){
        var rect = el.getBoundingClientRect();
        var cx = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
        var cy = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
        return {
          x: Math.max(0, Math.min(1, (cx - rect.left) / rect.width)),
          y: Math.max(0, Math.min(1, (cy - rect.top) / rect.height))
        };
      }

      function bindDrag(el, handler){
        function onMove(e){ handler(pointFromEvent(e, el)); if (e.cancelable) e.preventDefault(); }
        function onDown(e){
          dragging = el;
          onMove(e);
          window.addEventListener('mousemove', onMove);
          window.addEventListener('touchmove', onMove, { passive: false });
          window.addEventListener('mouseup', onUp);
          window.addEventListener('touchend', onUp);
        }
        function onUp(){
          dragging = null;
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('touchmove', onMove);
          window.removeEventListener('mouseup', onUp);
          window.removeEventListener('touchend', onUp);
        }
        el.addEventListener('mousedown', onDown);
        el.addEventListener('touchstart', onDown, { passive: false });
      }

      function init(refsObj){
        canvas = refsObj.canvas; thumb = refsObj.thumb;
        hueTrack = refsObj.hueTrack; hueThumb = refsObj.hueThumb;
        alphaTrack = refsObj.alphaTrack; alphaThumb = refsObj.alphaThumb;
        previewChip = refsObj.previewChip; textInput = refsObj.textInput;
        onChangeCb = refsObj.onChange || null;
        if (canvas && !ctx) ctx = canvas.getContext('2d');
        if (!canvas || canvas._ccpBound) { render(); return; }
        canvas._ccpBound = true;

        bindDrag(canvas, function(pt){ setHsva(null, pt.x*100, (1-pt.y)*100, null, { skipCanvasPaint: true }); });
        bindDrag(hueTrack, function(pt){ setHsva(pt.x*360, null, null, null); });
        bindDrag(alphaTrack, function(pt){ setHsva(null, null, null, pt.x); });

        window.addEventListener('resize', function(){ render(); });
      }

      return {
        init: init,
        setFromString: setFromString,
        setHsva: setHsva,
        currentCss: currentCss,
        currentHex: currentHex,
        render: render
      };
    })();

    function syncPickerUIFromSetting(setting){
      _activeMode = (setting && setting.mode) || 'theme';
      _pendingImageDataUrl = (setting && setting.mode === 'image') ? setting.value : '';
      _contrastPref = (setting && setting.contrastPref) || 'auto';

      var switchEl = document.getElementById('cbmModeSwitch');
      if (switchEl){
        switchEl.setAttribute('data-active', _activeMode === 'theme' ? '' : _activeMode);
        switchEl.querySelectorAll('.cbm-mode-btn').forEach(function(btn){
          btn.classList.toggle('is-active', btn.getAttribute('data-mode') === _activeMode);
        });
      }
      renderModePanels();
      renderPreview();
      renderContrastUI();

      if (_activeMode === 'color'){
        var v = (setting && setting.value) || '#e3c9d1';
        ColorPicker.setFromString(v);
      }else{
        ColorPicker.setFromString('#e3c9d1');
      }
    }

    function renderModePanels(){
      var panelColor = document.getElementById('cbmPanelColor');
      var panelImage = document.getElementById('cbmPanelImage');
      var panelContrast = document.getElementById('cbmPanelContrast');
      if (panelColor) panelColor.hidden = _activeMode !== 'color';
      if (panelImage) panelImage.hidden = _activeMode !== 'image';
      /* 文字明暗开关仅在自定义背景（纯色/图片）时才有意义 */
      if (panelContrast) panelContrast.hidden = (_activeMode !== 'color' && _activeMode !== 'image');
    }

    /* 三态提示文案，随当前选择更新，让用户明确知道"自动"具体会怎样判断 */
    var CONTRAST_TIPS = {
      auto: '自动：根据背景明暗实时判断，深色背景自动变白字，浅色背景自动变黑字',
      light: '始终使用浅色（白色系）文字，适合较暗的背景',
      dark: '始终使用深色（墨色系）文字，适合较亮的背景'
    };

    function renderContrastUI(){
      var switchEl = document.getElementById('cbmContrastSwitch');
      var tip = document.getElementById('cbmContrastTip');
      if (switchEl){
        switchEl.setAttribute('data-active', _contrastPref === 'auto' ? '' : _contrastPref);
        switchEl.querySelectorAll('.cbm-contrast-btn').forEach(function(btn){
          btn.classList.toggle('is-active', btn.getAttribute('data-contrast') === _contrastPref);
        });
      }
      if (tip) tip.textContent = CONTRAST_TIPS[_contrastPref] || CONTRAST_TIPS.auto;
    }

    function renderPreview(){
      var preview = document.getElementById('cbmPreview');
      var hint = document.getElementById('cbmPreviewHint');
      if (!preview) return;
      preview.style.backgroundImage = '';
      preview.style.background = '';
      if (_activeMode === 'color'){
        var v = ColorPicker.currentCss();
        preview.style.background = v;
        if (hint) hint.textContent = '纯色背景 · ' + v;
      }else if (_activeMode === 'image' && _pendingImageDataUrl){
        preview.style.backgroundImage = 'url("' + _pendingImageDataUrl + '")';
        if (hint) hint.textContent = '图片背景 · 已选择';
      }else{
        if (hint) hint.textContent = '跟随日记本原有主题色';
      }
    }

    function buildSwatches(){
      var wrap = document.getElementById('cbmSwatches');
      if (!wrap || wrap.children.length) return;
      wrap.innerHTML = PRESET_SWATCHES.map(function(c){
        return '<button type="button" class="cbm-swatch" data-color="' + c + '" style="background:' + c + '" aria-label="选择颜色 ' + c + '"></button>';
      }).join('');
    }

    function ensureBgRefs(){
      return {
        veil: document.getElementById('cdhBgVeil'),
        modal: document.getElementById('cdhBgModal'),
        trigger: document.getElementById('cdhBgTrigger'),
        closeBtn: document.getElementById('cdhBgCloseBtn'),
        switchEl: document.getElementById('cbmModeSwitch'),
        colorText: document.getElementById('cbmColorText'),
        swatches: document.getElementById('cbmSwatches'),
        uploadBtn: document.getElementById('cbmUploadBtn'),
        uploadText: document.getElementById('cbmUploadText'),
        fileInput: document.getElementById('cbmFileInput'),
        resetBtn: document.getElementById('cbmResetBtn'),
        confirmBtn: document.getElementById('cbmConfirmBtn'),
        ccpCanvas: document.getElementById('ccpCanvas'),
        ccpThumb: document.getElementById('ccpThumb'),
        ccpHueTrack: document.getElementById('ccpHueTrack'),
        ccpHueThumb: document.getElementById('ccpHueThumb'),
        ccpAlphaTrack: document.getElementById('ccpAlphaTrack'),
        ccpAlphaThumb: document.getElementById('ccpAlphaThumb'),
        ccpPreviewChip: document.getElementById('ccpPreviewChip'),
        ccpEyedrop: document.getElementById('ccpEyedrop')
      };
    }

    function openBgModalFor(char){
      var refs = ensureBgRefs();
      if (!refs.veil || !refs.modal || !char) return;
      var page = document.getElementById('cdhPage');
      if (page) page.setAttribute('data-current-char-id', char.id);

      /* 弹窗本身不在 .cdh-page 内部（同级节点），CSS 变量默认拿不到当前
         角色的皮肤色。这里把 page 当前挂载的 skin-* class 同步搬到弹窗
         根节点上，让"调色印"弹窗天然呈现这本日记自己的主题色，
         而不是脱离上下文的通用灰调。 */
      var skinClasses = ['skin-a','skin-b','skin-c','skin-d','skin-e','skin-f'];
      skinClasses.forEach(function(sk){ refs.modal.classList.remove(sk); });
      if (page){
        var activeSkin = skinClasses.filter(function(sk){ return page.classList.contains(sk); })[0];
        if (activeSkin) refs.modal.classList.add(activeSkin);
      }

      buildSwatches();

      ColorPicker.init({
        canvas: refs.ccpCanvas,
        thumb: refs.ccpThumb,
        hueTrack: refs.ccpHueTrack,
        hueThumb: refs.ccpHueThumb,
        alphaTrack: refs.ccpAlphaTrack,
        alphaThumb: refs.ccpAlphaThumb,
        previewChip: refs.ccpPreviewChip,
        textInput: refs.colorText,
        onChange: function(){ renderPreview(); }
      });

      getBgSetting(char.id).then(function(setting){
        syncPickerUIFromSetting(setting);
      });

      refs.veil.classList.add('show');
      refs.modal.classList.add('show');
      refs.modal.setAttribute('aria-hidden', 'false');
    }

    function closeBgModal(){
      var refs = ensureBgRefs();
      if (!refs.veil || !refs.modal) return;
      /* 关闭前先把焦点移出容器，避免"隐藏一个仍被聚焦的元素"的无障碍警告 */
      var active = document.activeElement;
      if (active && refs.modal.contains(active)) active.blur();
      refs.veil.classList.remove('show');
      refs.modal.classList.remove('show');
      refs.modal.setAttribute('aria-hidden', 'true');
    }

    function readFileAsDataURL(file){
      return new Promise(function(resolve, reject){
        var reader = new FileReader();
        reader.onload = function(){ resolve(reader.result); };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    document.addEventListener('DOMContentLoaded', function(){
      var refs = ensureBgRefs();

      if (refs.trigger){
        refs.trigger.addEventListener('click', function(){
          if (window.navigator && window.navigator.vibrate){ try{ window.navigator.vibrate(5); }catch(e){} }
          /* 复用 Part E 打开时缓存的 currentChar：通过书架点击链路可拿到，
             这里从最近一次 openCharDiaryHome 挂载的 data 属性反查角色对象 */
          var charId = getCurrentChar();
          if (!charId || !window._LunaCharBookShared) return;
          /* 从最近一次书架渲染缓存里找到完整角色对象（含 id/name） */
          var cache = window._LunaCharDiaryLastChars || [];
          var char = cache.filter(function(c){ return String(c.id) === String(charId); })[0] || { id: charId };
          openBgModalFor(char);
        });
      }
      if (refs.closeBtn) refs.closeBtn.addEventListener('click', closeBgModal);
      if (refs.veil) refs.veil.addEventListener('click', closeBgModal);

      if (refs.switchEl){
        refs.switchEl.addEventListener('click', function(e){
          var btn = e.target.closest ? e.target.closest('.cbm-mode-btn') : null;
          if (!btn) return;
          _activeMode = btn.getAttribute('data-mode');
          refs.switchEl.setAttribute('data-active', _activeMode === 'theme' ? '' : _activeMode);
          refs.switchEl.querySelectorAll('.cbm-mode-btn').forEach(function(b){
            b.classList.toggle('is-active', b === btn);
          });
          renderModePanels();
          renderPreview();
          renderContrastUI();
          if (window.navigator && window.navigator.vibrate){ try{ window.navigator.vibrate(4); }catch(e){} }
        });
      }

      var contrastSwitchEl = document.getElementById('cbmContrastSwitch');
      if (contrastSwitchEl){
        contrastSwitchEl.addEventListener('click', function(e){
          var btn = e.target.closest ? e.target.closest('.cbm-contrast-btn') : null;
          if (!btn) return;
          _contrastPref = btn.getAttribute('data-contrast') || 'auto';
          renderContrastUI();
          if (window.navigator && window.navigator.vibrate){ try{ window.navigator.vibrate(4); }catch(e){} }
        });
      }

      if (refs.colorText){
        refs.colorText.addEventListener('input', function(){
          var v = refs.colorText.value.trim();
          if (v) ColorPicker.setFromString(v, { skipText: true });
          renderPreview();
        });
      }
      if (refs.swatches){
        refs.swatches.addEventListener('click', function(e){
          var sw = e.target.closest ? e.target.closest('.cbm-swatch') : null;
          if (!sw) return;
          var c = sw.getAttribute('data-color');
          ColorPicker.setFromString(c);
          refs.swatches.querySelectorAll('.cbm-swatch').forEach(function(s){ s.classList.toggle('is-selected', s === sw); });
          renderPreview();
          if (window.navigator && window.navigator.vibrate){ try{ window.navigator.vibrate(4); }catch(e){} }
        });
      }

      if (refs.uploadBtn) refs.uploadBtn.addEventListener('click', function(){
        if (refs.fileInput) refs.fileInput.click();
      });

      /* 屏幕取色：仅在浏览器支持 EyeDropper API 时显示，取自定制颜色 */
      if (refs.ccpEyedrop){
        if (window.EyeDropper){
          refs.ccpEyedrop.hidden = false;
          refs.ccpEyedrop.addEventListener('click', function(){
            try{
              var ed = new window.EyeDropper();
              ed.open().then(function(result){
                if (result && result.sRGBHex){
                  ColorPicker.setFromString(result.sRGBHex);
                  renderPreview();
                }
              }).catch(function(){});
            }catch(e){}
          });
        }
      }      if (refs.fileInput){
        refs.fileInput.addEventListener('change', function(){
          var file = refs.fileInput.files && refs.fileInput.files[0];
          if (!file) return;
          readFileAsDataURL(file).then(function(dataUrl){
            _pendingImageDataUrl = dataUrl;
            if (refs.uploadText) refs.uploadText.textContent = file.name.length > 16 ? file.name.slice(0, 16) + '…' : file.name;
            renderPreview();
          });
        });
      }

      if (refs.resetBtn) refs.resetBtn.addEventListener('click', function(){
        _activeMode = 'theme';
        _pendingImageDataUrl = '';
        _contrastPref = 'auto';
        var switchEl = refs.switchEl;
        if (switchEl){
          switchEl.setAttribute('data-active', '');
          switchEl.querySelectorAll('.cbm-mode-btn').forEach(function(b){
            b.classList.toggle('is-active', b.getAttribute('data-mode') === 'theme');
          });
        }
        renderModePanels();
        renderPreview();
        renderContrastUI();
      });
      if (refs.confirmBtn) refs.confirmBtn.addEventListener('click', function(){
        var charId = getCurrentChar();
        if (!charId) { closeBgModal(); return; }

        var mode = _activeMode;
        var value = '';
        if (mode === 'color'){
          value = ColorPicker.currentCss() || '';
          if (!value){ mode = 'theme'; }
        }else if (mode === 'image'){
          value = _pendingImageDataUrl || '';
          if (!value){ mode = 'theme'; }
        }
        var contrastPref = _contrastPref;

        var applyAndClose = function(){
          var page = document.getElementById('cdhPage');
          applySettingToNode(page, mode === 'theme' ? null : { mode: mode, value: value }, false);
          applyAutoContrast(page, mode, value, contrastPref);
          var book = document.querySelector('.char-book[data-char-id="' + charId + '"]');
          applySettingToNode(book, mode === 'theme' ? null : { mode: mode, value: value }, true);
          if (window.navigator && window.navigator.vibrate){ try{ window.navigator.vibrate(6); }catch(e){} }
          closeBgModal();
        };

        if (mode === 'theme'){
          deleteBgSetting(charId).then(applyAndClose);
        }else{
          saveBgSetting(charId, mode, value, contrastPref).then(applyAndClose);
        }
      });
    });

  })();

})();