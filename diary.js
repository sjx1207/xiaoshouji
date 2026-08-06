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
    ['statusTime', 'detailStatusTime'].forEach(function(id){
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
    [['batPct','batInner'], ['detailBatPct','detailBatInner']].forEach(function(pair){
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
    var els = ['statusIsland', 'detailStatusIsland']
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

  function loadEntries(){
    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch(e){ return []; }
  }

  function saveEntries(list){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }catch(e){}
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

    /* 配图：选择文件 → 弹出描述弹层 → 确认后加入 currentPhotos */
    if (photoAddBtn && photoFileInput){
      photoAddBtn.addEventListener('click', function(){
        photoFileInput.click();
      });
      photoFileInput.addEventListener('change', function(){
        var file = photoFileInput.files && photoFileInput.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(e){
          pendingPhotoDataUrl = e.target.result;
          openPhotoDescModal(pendingPhotoDataUrl);
        };
        reader.readAsDataURL(file);
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
        saveEntries(list);

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

    function bindBookTapFeedback(){
      var shelf = document.getElementById('charShelf');
      if (!shelf) return;
      shelf.addEventListener('click', function(e){
        var book = e.target.closest ? e.target.closest('.char-book') : null;
        if (!book) return;
        if (window.navigator && window.navigator.vibrate){
          try{ window.navigator.vibrate(6); }catch(err){}
        }
        /* 日记内容体系尚未接入：轻触觉反馈 + 轻微缩放即为当前完整反馈，
           后续对接真实日记数据后，这里将跳转进入该角色日记本的翻阅详情页 */
      });
    }

    function renderCharShelf(chars){
      var emptyEl = document.getElementById('charDiaryEmpty');
      var shelfWrap = document.getElementById('charShelfWrap');
      var shelf = document.getElementById('charShelf');
      var countEl = document.getElementById('ctbCount');
      var topbar = document.getElementById('charTopbar');
      if (!emptyEl || !shelfWrap || !shelf) return;

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
    }

    var _charShelfLoaded = false;

    function loadAndRenderChars(){
      getAllCharsReadOnly().then(function(chars){
        renderCharShelf(chars || []);
        _charShelfLoaded = true;
      });
    }

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

})();