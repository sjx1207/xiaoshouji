/* ==========================================================================
   Favorites Overlay — favorites.js
   收藏总览页交互逻辑：
   - 唯一入口："我的"页面 → 我的空间 → 我的收藏 卡片
   - 消息收藏：按角色（friendKey）分组渲染档案卡，背景图读取角色档案
     （LunaCharDB）里设置的 cardBg，取值优先级与 friend-profile.js
     完全一致：角色档案背景图 → 角色档案头像 → 好友自身头像快照 → 色阶渐变
   - 实时更新：监听 CustomEvent('luna:favorites-changed')（收藏/取消收藏后
     由 chat.js 的 window.LunaFavorites 广播），原地增删 DOM，不刷新整页
   - 动态收藏：结构已搭好（tab + 面板），内容为"敬请期待"占位
========================================================================== */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') init();

  /* ---- 与 friend-profile.js / chatroom.js 完全一致的色阶表 ---- */
  var COLOR_MAP = {
    ink:    { strip: 'linear-gradient(150deg,#3a3a40,#1c1c1f 55%,#0a0a0b)', avBg:'#101012', avCol:'#c9c9cd' },
    slate:  { strip: 'linear-gradient(150deg,#7a7a82,#54545c 55%,#2c2c30)', avBg:'#141416', avCol:'#b8bac0' },
    silver: { strip: 'linear-gradient(150deg,#b8b8bc,#8c8c92 55%,#525258)', avBg:'#1a1a1c', avCol:'#d4d4d8' },
    frost:  { strip: 'linear-gradient(150deg,#c4c8cc,#9aa0a6 55%,#5c6268)', avBg:'#111316', avCol:'#c8ccd0' },
    smoke:  { strip: 'linear-gradient(150deg,#6a6a70,#3c3c42 55%,#18181a)', avBg:'#0e0e10', avCol:'#bdbdc2' },
    pearl:  { strip: 'linear-gradient(150deg,#d6d6d8,#adadb2 55%,#727278)', avBg:'#1c1c1e', avCol:'#e0e0e3' }
  };

  /* ---- LunaCharDB 只读访问：与 friend-profile.js 完全同一套逻辑，
     数据库/store 若尚不存在则安全返回 null，回退到色阶占位 ---- */
  var _charDb = null;
  function openCharDbReadOnly() {
    if (_charDb) return Promise.resolve(_charDb);
    return new Promise(function (resolve) {
      if (!window.indexedDB) { resolve(null); return; }
      var req = indexedDB.open('LunaCharDB');
      req.onsuccess = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('chars')) { db.close(); resolve(null); return; }
        _charDb = db;
        resolve(db);
      };
      req.onerror = function () { resolve(null); };
      req.onupgradeneeded = function (e) { e.target.transaction.abort(); };
    }).catch(function () { return null; });
  }

  function getCharById(charId) {
    if (charId == null) return Promise.resolve(null);
    return openCharDbReadOnly().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        try {
          var req = db.transaction('chars', 'readonly').objectStore('chars').get(charId);
          req.onsuccess = function () { resolve(req.result || null); };
          req.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    }).catch(function () { return null; });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtFavTime(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var now = new Date();
    var sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    var hm = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    if (sameDay) return '今天 ' + hm;
    var oneDay = 24 * 60 * 60 * 1000;
    var isYesterday = now - d < oneDay * 2 && now.getDate() - d.getDate() === 1;
    if (isYesterday) return '昨天 ' + hm;
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + hm;
  }

  function init() {
    var overlay = document.getElementById('favOverlay');
    if (!overlay) return;

    var backBtn = document.getElementById('favBackBtn');
    var tabBtns = Array.prototype.slice.call(document.querySelectorAll('.fav-tab-btn'));
    var paneMsg = document.getElementById('favPaneMessages');
    var paneMoments = document.getElementById('favPaneMoments');
    var gridEl = document.getElementById('favCharGrid');
    var blankEl = document.getElementById('favMsgBlank');
    var countEl = document.getElementById('favMsgCount');

    var detail = document.getElementById('favCharDetail');
    var detailBack = document.getElementById('favDetailBack');
    var detailBg = document.getElementById('favDetailHeroBg');
    var detailAvatar = document.getElementById('favDetailAvatar');
    var detailName = document.getElementById('favDetailName');
    var detailCount = document.getElementById('favDetailCount');
    var detailList = document.getElementById('favDetailList');

    var lastFocused = null;
    var currentFriendKey = null; // 当前详情层展示的是哪个角色/好友的收藏

    /* ---- 开关总览层：唯一入口是"我的"页的收藏卡 ---- */
    function openOverlay() {
      lastFocused = document.activeElement;
      syncStatusBar();
      renderAll();
      overlay.removeAttribute('inert');
      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.add('fav-open');
      document.body.style.overflow = 'hidden';
    }
    function closeOverlay() {
      // 顺序依旧关键：先关掉详情子层（它自己也用 inert，见 closeDetail），
      // 再对总览层本身打 inert。用 inert 代替旧的"手动判断焦点、
      // 手动 .focus()/.blur()"写法——旧写法依赖 lastFocused 当时
      // 必须是可聚焦的，一旦不满足就会静默失败、焦点挪不走，
      // "Blocked aria-hidden" 警告就会再现。inert 由浏览器原生
      // 处理焦点挪出，不依赖任何具体 fallback 目标是否可用。
      closeDetail();
      overlay.setAttribute('inert', '');
      overlay.classList.remove('fav-open');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';

      // inert 已经把焦点安全挪出去了，这里再尝试把焦点还给打开前
      // 的那个入口，纯粹是体验加分项，失败也只是静默 no-op。
      if (lastFocused && typeof lastFocused.focus === 'function') {
        lastFocused.focus();
      }
    }

    var entryBtn = document.getElementById('profileEntryFavorites');
    if (entryBtn) entryBtn.addEventListener('click', openOverlay);
    if (backBtn) backBtn.addEventListener('click', closeOverlay);

    // 向全局覆盖层注册表报到，原因与表情包总览层一致。
    window.LunaOverlays = window.LunaOverlays || [];
    window.LunaOverlays.push({
      closeIfOpen: function () {
        if (overlay.classList.contains('fav-open')) closeOverlay();
      }
    });

    /* ---- 两分区切换 ---- */
    tabBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = btn.getAttribute('data-fav-tab');
        tabBtns.forEach(function (b) { b.classList.toggle('is-active', b === btn); });
        paneMsg.classList.toggle('is-active', target === 'messages');
        paneMoments.classList.toggle('is-active', target === 'moments');
      });
    });

    /* ==========================================================================
       消息收藏：读取 → 按 friendKey 分组 → 渲染档案卡网格
    ========================================================================== */
    function groupByFriend(list) {
      var map = {};
      var order = [];
      list.forEach(function (rec) {
        if (!map[rec.friendKey]) {
          map[rec.friendKey] = [];
          order.push(rec.friendKey);
        }
        map[rec.friendKey].push(rec);
      });
      // 每组内按收藏时间倒序（最新收藏的在前）
      order.forEach(function (key) {
        map[key].sort(function (a, b) { return b.favoritedAt - a.favoritedAt; });
      });
      // 组之间按"最新收藏时间"倒序排列，最近有新收藏的角色排在最前
      order.sort(function (ka, kb) {
        return map[kb][0].favoritedAt - map[ka][0].favoritedAt;
      });
      return { map: map, order: order };
    }

    var _cardSeq = 0;
    function buildCharCard(friendKey, records) {
      var rec0 = records[0]; // 快照信息（昵称/头像/色阶）取组内最新一条
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'fav-char-card';
      card.setAttribute('data-friend-key', friendKey);

      var col = COLOR_MAP[rec0.color] || COLOR_MAP.ink;
      var lastText = records[0].text || (records[0].quote ? '[引用消息]' : '');
      _cardSeq += 1;
      var indexNum = _cardSeq < 10 ? '0' + _cardSeq : String(_cardSeq);

      card.innerHTML =
        '<span class="fav-char-card-bg" style="background:' + col.strip + '"></span>' +
        '<span class="fav-char-card-texture" aria-hidden="true"></span>' +
        '<span class="fav-char-card-scrim" aria-hidden="true"></span>' +
        '<span class="fav-char-card-sheen" aria-hidden="true"></span>' +
        '<span class="fav-char-card-corner fav-char-card-corner-tl" aria-hidden="true"></span>' +
        '<span class="fav-char-card-corner fav-char-card-corner-br" aria-hidden="true"></span>' +
        '<span class="fav-char-card-mark"></span>' +
        '<span class="fav-char-card-index">' +
          '<span class="fav-char-card-index-num">' + indexNum + '</span>' +
          '<span class="fav-char-card-index-en">ARCHIVE</span>' +
        '</span>' +
        '<span class="fav-char-card-badge">' + records.length + '</span>' +
        '<span class="fav-char-card-hair" aria-hidden="true"></span>' +
        '<span class="fav-char-card-foot">' +
          '<span class="fav-char-card-name">' + escapeHtml(rec0.friendName || '未知好友') + '</span>' +
          '<span class="fav-char-card-preview">' + escapeHtml(lastText || '暂无预览') + '</span>' +
          '<span class="fav-char-card-sub">FAVORITE&nbsp;ARCHIVE</span>' +
        '</span>';

      // 背景/头像：先用快照数据占位，若关联角色档案则异步覆盖为
      // 角色档案里设置的 cardBg（优先）/ 档案头像，与 friend-profile.js
      // 的取值优先级完全一致：cardBg → 档案头像 → 好友自身头像 → 色阶渐变
      var markEl = card.querySelector('.fav-char-card-mark');
      var bgEl = card.querySelector('.fav-char-card-bg');
      applyCardVisual(bgEl, markEl, rec0, col);

      card.addEventListener('click', function () {
        openDetail(friendKey);
      });
      return card;
    }

    function applyCardVisual(bgEl, markEl, rec0, col) {
      var initial = (rec0.friendName || '?').charAt(0);

      function renderFallback() {
        if (rec0.friendAvatar) {
          markEl.innerHTML = '<img src="' + rec0.friendAvatar + '" alt="" />';
          bgEl.style.background = 'none';
          bgEl.style.backgroundImage = 'url(' + rec0.friendAvatar + ')';
          bgEl.style.filter = 'saturate(0.82) brightness(0.92)';
        } else {
          markEl.innerHTML = '<span class="fav-char-card-mark-glyph" style="color:' + col.avCol + '">' + escapeHtml(initial) + '</span>';
        }
      }
      renderFallback();

      if (rec0.charId != null) {
        getCharById(rec0.charId).then(function (char) {
          if (!char) return;
          var cardBg = char.cardBg;
          var avatar = char.avatar || rec0.friendAvatar;
          if (cardBg) {
            bgEl.style.background = 'none';
            bgEl.style.backgroundImage = 'url(' + cardBg + ')';
            bgEl.style.filter = 'none';
          } else if (avatar) {
            bgEl.style.background = 'none';
            bgEl.style.backgroundImage = 'url(' + avatar + ')';
            bgEl.style.filter = 'saturate(0.82) brightness(0.92)';
          }
          if (avatar) markEl.innerHTML = '<img src="' + avatar + '" alt="" />';
        });
      }
    }

    function renderAll() {
      if (!window.LunaFavorites) return;
      window.LunaFavorites.getMessageFavorites().then(function (list) {
        updateBadge(list.length);
        if (countEl) countEl.textContent = list.length + ' 条';

        if (!list.length) {
          gridEl.style.display = 'none';
          blankEl.style.display = 'flex';
          gridEl.innerHTML = '';
          // 若详情层正开着且已无数据，收起
          if (detail.classList.contains('is-open')) closeDetail();
          return;
        }
        blankEl.style.display = 'none';
        gridEl.style.display = 'flex';

        var grouped = groupByFriend(list);
        gridEl.innerHTML = '';
        _cardSeq = 0;
        grouped.order.forEach(function (key) {
          gridEl.appendChild(buildCharCard(key, grouped.map[key]));
        });

        // 若详情层正开着，原地刷新其列表内容（保持展开状态，不闪烁跳转）
        if (detail.classList.contains('is-open') && currentFriendKey) {
          if (grouped.map[currentFriendKey]) {
            renderDetailList(grouped.map[currentFriendKey]);
          } else {
            closeDetail(); // 该角色的收藏已被清空
          }
        }
      });
    }

    /* ---- "我的"页收藏卡数字角标：0 条时也如实显示 0，不是隐藏角标 ---- */
    function updateBadge(count) {
      var badge = entryBtn ? entryBtn.querySelector('.pf-tile-badge') : null;
      if (badge) badge.textContent = String(count);
    }

    /* ==========================================================================
       角色详情子层：展开某一角色的完整收藏列表
    ========================================================================== */
    function openDetail(friendKey) {
      currentFriendKey = friendKey;
      window.LunaFavorites.getMessageFavorites().then(function (list) {
        var records = list.filter(function (r) { return r.friendKey === friendKey; })
          .sort(function (a, b) { return b.favoritedAt - a.favoritedAt; });
        if (!records.length) return;

        var rec0 = records[0];
        var col = COLOR_MAP[rec0.color] || COLOR_MAP.ink;
        detailBg.style.background = col.strip;
        detailBg.style.filter = 'none';
        detailName.textContent = rec0.friendName || '未知好友';
        detailCount.textContent = records.length + ' 条收藏 · FAVORITED MESSAGES';

        if (rec0.friendAvatar) {
          detailAvatar.innerHTML = '<img src="' + rec0.friendAvatar + '" alt="" />';
          detailBg.style.backgroundImage = 'url(' + rec0.friendAvatar + ')';
          detailBg.style.filter = 'saturate(0.85)';
        } else {
          detailAvatar.innerHTML = '<span class="fav-detail-avatar-glyph">' + escapeHtml((rec0.friendName || '?').charAt(0)) + '</span>';
        }

        if (rec0.charId != null) {
          getCharById(rec0.charId).then(function (char) {
            if (!char) return;
            var cardBg = char.cardBg;
            var avatar = char.avatar || rec0.friendAvatar;
            if (cardBg) {
              detailBg.style.backgroundImage = 'url(' + cardBg + ')';
              detailBg.style.filter = 'none';
            } else if (avatar) {
              detailBg.style.backgroundImage = 'url(' + avatar + ')';
              detailBg.style.filter = 'saturate(0.85)';
            }
            if (avatar) detailAvatar.innerHTML = '<img src="' + avatar + '" alt="" />';
          });
        }

        renderDetailList(records);
        detail.classList.add('is-open');
        detail.removeAttribute('inert');
        detail.setAttribute('aria-hidden', 'false');
        syncStatusBar();
        if (detailList) detailList.scrollTop = 0;
      });
    }

    function closeDetail() {
      // 用 inert 代替手动判断焦点位置，浏览器会自动把焦点挪出这个
      // 详情子层，不需要我们猜测该挪去哪个按钮。
      detail.setAttribute('inert', '');
      detail.classList.remove('is-open');
      detail.setAttribute('aria-hidden', 'true');
      currentFriendKey = null;
    }
    if (detailBack) detailBack.addEventListener('click', closeDetail);

    function renderDetailList(records) {
      detailList.innerHTML = '';
      records.forEach(function (rec) {
        detailList.appendChild(buildMsgCard(rec));
      });
    }

    function buildMsgCard(rec) {
      var card = document.createElement('div');
      card.className = 'fav-msg-card' + (rec.from === 'me' ? ' is-me' : '');
      card.setAttribute('data-fav-id', rec.id);

      var quoteHtml = '';
      if (rec.quote && rec.quote.text) {
        quoteHtml =
          '<span class="fav-msg-card-quote">' +
            '<span class="fav-msg-card-quote-bar" aria-hidden="true"></span>' +
            '<span class="fav-msg-card-quote-text">' + escapeHtml(rec.quote.text) + '</span>' +
          '</span>';
      }

      card.innerHTML =
        '<span class="fav-msg-card-rail" aria-hidden="true"></span>' +
        '<span class="fav-msg-card-body">' +
          '<span class="fav-msg-card-meta">' +
            '<span class="fav-msg-card-who">' + (rec.from === 'me' ? '我' : escapeHtml(rec.friendName || '对方')) + '</span>' +
            '<span class="fav-msg-card-time">' + formatOrigTime(rec.ts) + '</span>' +
          '</span>' +
          quoteHtml +
          '<span class="fav-msg-card-text">' + escapeHtml(rec.text || '') + '</span>' +
          '<span class="fav-msg-card-foot">' +
            '<span class="fav-msg-card-favtime">收藏于 ' + fmtFavTime(rec.favoritedAt) + '</span>' +
            '<span class="fav-msg-card-unstar" data-unstar="' + rec.id + '">' +
              '<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 4L14.3 9.7L20.5 10.3L15.8 14.3L17.2 20.4L12 17.1L6.8 20.4L8.2 14.3L3.5 10.3L9.7 9.7L12 4Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>' +
              '<span>取消收藏</span>' +
            '</span>' +
          '</span>' +
        '</span>';

      var unstarBtn = card.querySelector('[data-unstar]');
      unstarBtn.addEventListener('click', function (evt) {
        evt.stopPropagation();
        card.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
        card.style.opacity = '0';
        card.style.transform = 'translateX(8px)';
        window.LunaFavorites.removeMessageFavorite(rec.id);
        // renderAll() 会在 luna:favorites-changed 广播回来时自动重绘，
        // 这里的淡出只是即时的视觉反馈，避免等待广播的空档期显得卡顿
      });

      return card;
    }

    function formatOrigTime(ts) {
      if (!ts) return '';
      var d = new Date(ts);
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    }

    /* ---- 实时更新：收藏/取消收藏后，无论触发源是本页还是聊天室，
       都会广播 luna:favorites-changed，这里原地重绘，不刷新整页 ---- */
    document.addEventListener('luna:favorites-changed', function () {
      renderAll();
    });

    // 打开总览层前也应先算好角标数字（即便用户尚未点开收藏页，
    // "我的"页卡片上的数字也应实时反映真实收藏数）
    if (window.LunaFavorites) {
      window.LunaFavorites.getMessageFavorites().then(function (list) {
        updateBadge(list.length);
      });
    }

    /* ---- 状态栏时间/电量：与主状态栏同源，30 秒节奏刷新；
       同时驱动总览层与角色详情层两套状态栏 DOM，保持数字一致 ---- */
    function syncStatusBar() {
      var tz = 'Asia/Shanghai';
      try { tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai'; } catch (e) {}
      var now = new Date();
      var hm = now.toLocaleTimeString('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });

      var pct = 76;
      try {
        var saved = localStorage.getItem('luna_battery');
        if (saved !== null && !isNaN(parseInt(saved, 10))) {
          pct = Math.max(1, Math.min(100, parseInt(saved, 10)));
        }
      } catch (e) {}

      [
        ['favStatusTime', 'favBatPct', 'favBatInner'],
        ['favDetailStatusTime', 'favDetailBatPct', 'favDetailBatInner']
      ].forEach(function (ids) {
        var timeEl = document.getElementById(ids[0]);
        var pctEl = document.getElementById(ids[1]);
        var innerEl = document.getElementById(ids[2]);
        if (timeEl) timeEl.textContent = hm;
        if (pctEl) pctEl.textContent = pct;
        if (innerEl) innerEl.style.width = pct + '%';
      });
    }
    setInterval(function () {
      if (overlay.classList.contains('fav-open')) syncStatusBar();
    }, 30000);
  }
})();