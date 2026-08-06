/* =========================================================================
   VENUE — 局 / 我 交互逻辑
   折扇时轴 · 液态导航 · 无初始数据的留白仪式
   ========================================================================= */
(function(){
  'use strict';

  /* ---------- 状态栏时间同步 ---------- */
  function syncStatusClock(){
    var el = document.getElementById('statusTime');
    if (!el) return;
    var now = new Date();
    el.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
  }
  syncStatusClock();
  setInterval(syncStatusClock, 30000);

  /* ---------- 顶部液态分段切换：局 / 我 ---------- */
  var tabSwitch = document.getElementById('tabSwitch');
  var hubPages  = document.getElementById('hubPages');
  var tabItems  = tabSwitch ? tabSwitch.querySelectorAll('.tab-switch__item') : [];

  function setActiveTab(target){
    tabItems.forEach(function(btn){
      var isActive = btn.dataset.target === target;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    tabSwitch.setAttribute('data-active', target);
    hubPages.setAttribute('data-active', target);
  }

  tabItems.forEach(function(btn){
    btn.addEventListener('click', function(){
      setActiveTab(btn.dataset.target);
    });
  });

  /* ---------- 更多入口占位（旋转反馈） ---------- */
  var moreSeal = document.getElementById('moreSeal');
  if (moreSeal){
    moreSeal.addEventListener('click', function(){
      console.log('[Venue] 打开更多菜单');
    });
  }

  /* =========================================================================
     折扇时轴大厅 — 核心物理布局
     每张卡片按其相对扇心（当前索引）的位移，计算旋转角 / 位移 / 层级 / 缩放，
     形成手持折扇展开的视觉效果。
     ========================================================================= */
  var fanStage  = document.getElementById('fanStage');
  var fanTrack  = document.getElementById('fanTrack');
  var cards     = fanTrack ? Array.prototype.slice.call(fanTrack.querySelectorAll('.gcard')) : [];
  var gauge     = document.getElementById('fanGauge');
  var detailTitle = document.getElementById('fanDetailTitle');
  var detailBody  = document.getElementById('fanDetailBody');
  var detailScale = document.getElementById('fanDetailScale');
  var fanEnter    = document.getElementById('fanEnter');

  var activeIndex = 0;
  var total = cards.length;

  /* 构建扇轴刻度（与卡片数量一致，非分类标签，而是折叠进度） */
  function buildGauge(){
    if (!gauge) return;
    gauge.innerHTML = '';
    for (var i = 0; i < total; i++){
      var blade = document.createElement('span');
      blade.className = 'fan-gauge__blade';
      gauge.appendChild(blade);
    }
  }
  buildGauge();

  function updateGauge(){
    var blades = gauge ? gauge.querySelectorAll('.fan-gauge__blade') : [];
    blades.forEach(function(b, i){
      b.classList.remove('is-past', 'is-current');
      if (i < activeIndex) b.classList.add('is-past');
      if (i === activeIndex) b.classList.add('is-current');
    });
  }

  /* 布局参数：模拟折扇——扇心卡片居中放大，两侧依次旋转、下沉、缩小、叠层 */
  var LAYOUT = {
    angleStep: 13,      // 每张相邻卡的旋转角差
    xStep: 46,          // 每张相邻卡的水平位移
    yStep: 20,          // 每张相邻卡的下沉位移（越远越低，呈扇骨弧线）
    scaleStep: 0.09,     // 每张相邻卡的缩放衰减
    maxVisible: 3        // 单侧最多展示的层数，超出则隐藏
  };

  function renderFan(){
    cards.forEach(function(card, i){
      var offset = i - activeIndex;
      var abs = Math.abs(offset);

      if (abs > LAYOUT.maxVisible){
        card.classList.add('is-hidden');
        return;
      }
      card.classList.remove('is-hidden');

      var angle = offset * LAYOUT.angleStep;
      var x     = offset * LAYOUT.xStep;
      var y     = abs * LAYOUT.yStep;
      var scale = 1 - abs * LAYOUT.scaleStep;
      var z     = -abs * 60;
      var zIndex = 100 - abs;

      card.style.transform =
        'translateX(' + x + 'px) translateY(' + y + 'px) translateZ(' + z + 'px) ' +
        'rotate(' + angle + 'deg) scale(' + scale + ')';
      card.style.zIndex = zIndex;
      card.style.filter = offset === 0 ? 'none' : 'brightness(' + (1 - abs * 0.07) + ')';
    });
    updateGauge();
    renderDetail();
  }

  function renderDetail(){
    var card = cards[activeIndex];
    if (!card || !detailTitle) return;
    // 重触发入场动画
    [detailTitle, detailBody, fanEnter].forEach(function(el){
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
    });
    detailTitle.textContent = card.dataset.title || '';
    detailBody.textContent  = card.dataset.desc || '';
    detailScale.textContent = '入局 · ' + (card.dataset.scale || '');
  }

  function goTo(index){
    activeIndex = Math.max(0, Math.min(total - 1, index));
    renderFan();
  }

  /* ---------- 局目 key → 实际页面路径的映射 ----------
     已实现的局目在此登记路径，未登记的局目暂以占位提示代替，
     待后续逐个设计实现后再补充映射即可。 */
  var GAME_ROUTES = {
    'bomb-number': 'game/bomb-number.html'
    // 'monopoly':      'game/monopoly.html',
    // 'bomb-cat':      'game/bomb-cat.html',
    // 'blackjack':     'game/blackjack.html',
    // 'high-low':      'game/high-low.html',
    // ……后续依次补充
  };

  function enterGame(card){
    if (!card) return;
    var key = card.dataset.key;
    var route = GAME_ROUTES[key];
    if (route){
      window.location.href = route;
    } else {
      console.log('[Venue] 该局目尚未上线 →', key);
    }
  }

  /* ---------- 点击卡片：若非扇心则移至扇心，若已是扇心则视为进入牌局 ---------- */
  cards.forEach(function(card, i){
    card.addEventListener('click', function(){
      if (i === activeIndex){
        enterGame(card);
      } else {
        goTo(i);
      }
    });
  });

  if (fanEnter){
    fanEnter.addEventListener('click', function(){
      enterGame(cards[activeIndex]);
    });
  }

  /* ---------- 拖拽 / 滑动翻阅 ---------- */
  var dragging = false;
  var startX = 0;
  var dragDelta = 0;
  var DRAG_THRESHOLD = 46;

  function pointerX(e){
    return (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
  }

  function onDragStart(e){
    dragging = true;
    startX = pointerX(e);
    dragDelta = 0;
    fanTrack.style.transition = 'none';
  }
  function onDragMove(e){
    if (!dragging) return;
    dragDelta = pointerX(e) - startX;
  }
  function onDragEnd(){
    if (!dragging) return;
    dragging = false;
    fanTrack.style.transition = '';
    if (dragDelta > DRAG_THRESHOLD) goTo(activeIndex - 1);
    else if (dragDelta < -DRAG_THRESHOLD) goTo(activeIndex + 1);
    dragDelta = 0;
  }

  if (fanStage){
    fanStage.addEventListener('mousedown', onDragStart);
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);

    fanStage.addEventListener('touchstart', onDragStart, { passive: true });
    fanStage.addEventListener('touchmove', onDragMove, { passive: true });
    fanStage.addEventListener('touchend', onDragEnd);
  }

  renderFan();

  /* =========================================================================
     我 — 名片编辑 / 游戏库上传 / 游玩记录
     ========================================================================= */

  var state = {
    name: '未命名的客',
    tag: '点击名片，写下你的名号',
    avatarDataUrl: null,
    library: [],   // { id, name, ext }
    records: []    // { id, title, meta, result } — 由真实对局产生，此处默认为空
  };

  var profileName  = document.getElementById('profileName');
  var profileTag   = document.getElementById('profileTag');
  var avatarCore   = document.getElementById('avatarCore');

  /* ---------- 名片弹层 ---------- */
  var idCardBtn      = document.getElementById('idCardBtn');
  var sheetOverlay   = document.getElementById('sheetOverlay');
  var sheetPanel     = document.getElementById('sheetPanel');
  var sheetNameInput = document.getElementById('sheetNameInput');
  var sheetTagInput  = document.getElementById('sheetTagInput');
  var sheetCancel    = document.getElementById('sheetCancel');
  var sheetSave      = document.getElementById('sheetSave');
  var sheetAvatarBtn = document.getElementById('sheetAvatarBtn');
  var sheetAvatarPreview = document.getElementById('sheetAvatarPreview');
  var avatarFileInput = document.getElementById('avatarFileInput');

  function openSheet(){
    sheetNameInput.value = state.name === '未命名的客' ? '' : state.name;
    sheetTagInput.value  = state.tag.indexOf('点击名片') === 0 ? '' : state.tag;
    syncAvatarPreview(sheetAvatarPreview);
    sheetOverlay.classList.add('is-open');
  }
  function closeSheet(){
    sheetOverlay.classList.remove('is-open');
  }

  if (idCardBtn) idCardBtn.addEventListener('click', openSheet);
  if (sheetCancel) sheetCancel.addEventListener('click', closeSheet);
  if (sheetOverlay){
    sheetOverlay.addEventListener('click', function(e){
      if (e.target === sheetOverlay) closeSheet();
    });
  }

  if (sheetSave){
    sheetSave.addEventListener('click', function(){
      var newName = sheetNameInput.value.trim();
      var newTag  = sheetTagInput.value.trim();
      state.name = newName || '未命名的客';
      state.tag  = newTag || '点击名片，写下你的名号';
      profileName.textContent = state.name;
      profileTag.textContent  = state.tag;
      closeSheet();
    });
  }

  function syncAvatarPreview(target){
    if (!target) return;
    if (state.avatarDataUrl){
      target.innerHTML = '<img src="' + state.avatarDataUrl + '" alt="头像" />';
    } else {
      target.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8.5" r="3.4" stroke="currentColor" stroke-width="1.1"/><path d="M5 20c1.6-4 4.2-6 7-6s5.4 2 7 6" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>';
    }
  }

  if (sheetAvatarBtn){
    sheetAvatarBtn.addEventListener('click', function(){
      sheetAvatarBtn.style.transform = 'scale(0.88)';
      setTimeout(function(){ sheetAvatarBtn.style.transform = ''; }, 140);
      avatarFileInput.click();
    });
  }
  if (avatarFileInput){
    avatarFileInput.addEventListener('change', function(){
      var file = avatarFileInput.files && avatarFileInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(e){
        state.avatarDataUrl = e.target.result;
        syncAvatarPreview(sheetAvatarPreview);
        syncAvatarPreview(avatarCore);
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- 游戏库：上传本地代码文件，加入自己的游戏库 ---------- */
  var addGameBtn      = document.getElementById('addGameBtn');
  var libEmptyCta     = document.getElementById('libEmptyCta');
  var gameFileInput   = document.getElementById('gameFileInput');
  var libList         = document.getElementById('libList');
  var libEmpty        = document.getElementById('libEmpty');

  function triggerFilePicker(){ gameFileInput.click(); }
  if (addGameBtn) addGameBtn.addEventListener('click', triggerFilePicker);
  if (libEmptyCta) libEmptyCta.addEventListener('click', triggerFilePicker);

  function extOf(filename){
    var parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toUpperCase() : 'FILE';
  }

  function renderLibrary(){
    if (state.library.length === 0){
      libEmpty.style.display = 'flex';
      // 清除已生成的条目（保留空态节点）
      Array.prototype.slice.call(libList.querySelectorAll('.lib-item')).forEach(function(n){ n.remove(); });
      return;
    }
    libEmpty.style.display = 'none';
    Array.prototype.slice.call(libList.querySelectorAll('.lib-item')).forEach(function(n){ n.remove(); });

    state.library.forEach(function(item){
      var row = document.createElement('div');
      row.className = 'lib-item';
      row.innerHTML =
        '<span class="lib-item__glyph">' + item.ext.slice(0,2) + '</span>' +
        '<span class="lib-item__body">' +
          '<p class="lib-item__name">' + item.name + '</p>' +
          '<p class="lib-item__meta">' + item.ext + ' · 已加入游戏库</p>' +
        '</span>' +
        '<button class="lib-item__remove" aria-label="移除" data-id="' + item.id + '">' +
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>' +
        '</button>';
      libList.appendChild(row);
    });

    libList.querySelectorAll('.lib-item__remove').forEach(function(btn){
      btn.addEventListener('click', function(){
        var id = btn.dataset.id;
        state.library = state.library.filter(function(g){ return g.id !== id; });
        renderLibrary();
      });
    });
  }

  if (gameFileInput){
    gameFileInput.addEventListener('change', function(){
      var files = Array.prototype.slice.call(gameFileInput.files || []);
      files.forEach(function(file){
        state.library.push({
          id: 'g' + Date.now() + Math.random().toString(16).slice(2),
          name: file.name,
          ext: extOf(file.name)
        });
      });
      gameFileInput.value = '';
      renderLibrary();
    });
  }

  renderLibrary();

  /* ---------- 游玩记录：默认空态，接入真实对局后按条目渲染 ---------- */
  var recordEmpty = document.getElementById('recordEmpty');
  var recordListEl = document.getElementById('recordList');

  function renderRecords(){
    if (state.records.length === 0){
      recordEmpty.style.display = 'flex';
      recordListEl.innerHTML = '';
      return;
    }
    recordEmpty.style.display = 'none';
    recordListEl.innerHTML = state.records.map(function(r){
      return '<div class="record-row">' +
        '<span class="record-row__icon">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.1"/><path d="M12 8v4l3 2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>' +
        '</span>' +
        '<span class="record-row__body">' +
          '<p class="record-row__title">' + r.title + '</p>' +
          '<p class="record-row__meta">' + r.meta + '</p>' +
        '</span>' +
        '<span class="record-row__result record-row__result--' + r.result + '">' +
          (r.result === 'win' ? '获胜' : r.result === 'lose' ? '告负' : '平局') +
        '</span>' +
      '</div>';
    }).join('');
  }

  renderRecords();

})();