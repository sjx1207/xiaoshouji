/* ==========================================================================
   Chat Log — chatlog.js
   聊天记录页面交互逻辑：
   - 入口守卫：与 chatroom.js / chatsetting.js 共用同一份会话令牌
     （sessionStorage），直接以 URL 打开本页时展示拦截层。
   - 数据源：与 chatroom.js 完全同源的 LunaDB key
     （chatroom:char-<id> / chatroom:name-<name>），只读渲染，
     不提供删除/撤回/编辑等任何修改操作。
   - 渲染：完整复用 chatroom.css 的气泡/日期徽记/头像月环视觉，
     DOM 结构与 chatroom.js 的 buildMsgGroup / buildDateSeal 对齐，
     保证「设置页里看到的条数」与「这里看到的内容」是同一份数据、
     同一套视觉语言，不会出现两边对不上的观感断层。
   - 搜索：本地纯文本过滤，不发起任何网络请求，切换即时生效，
     不做整页重渲染（只切换已渲染节点的显隐），杜绝卡顿。
   - 页面重新可见时（切回本标签页 / bfcache 恢复）自动重新读取一次
     数据，保证从聊天室发完消息再回到这里时是最新记录。
========================================================================== */
(function () {
  'use strict';

  var SESSION_KEY = 'luna_chat_session';

  var COLOR_MAP = {
    ink:    { avBg:'#101012', avCol:'#c9c9cd' },
    slate:  { avBg:'#141416', avCol:'#b8bac0' },
    silver: { avBg:'#1a1a1c', avCol:'#d4d4d8' },
    frost:  { avBg:'#111316', avCol:'#c8ccd0' },
    smoke:  { avBg:'#0e0e10', avCol:'#bdbdc2' },
    pearl:  { avBg:'#1c1c1e', avCol:'#e0e0e3' }
  };

  document.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') init();

  function init() {
    var session = readSession();
    if (!session) {
      document.body.setAttribute('data-crm-guard', 'blocked');
      return;
    }
    document.body.setAttribute('data-crm-guard', 'ok');

    var els = {
      backBtn: document.getElementById('cllBackBtn'),
      peerLine: document.getElementById('cllPeerLine'),
      searchBtn: document.getElementById('cllSearchBtn'),
      searchBar: document.getElementById('cllSearchBar'),
      searchInput: document.getElementById('cllSearchInput'),
      searchClear: document.getElementById('cllSearchClear'),
      searchOptBtn: document.getElementById('cllSearchOptBtn'),
      searchOpts: document.getElementById('cllSearchOpts'),
      fromChips: document.getElementById('cllFromChips'),
      caseSwitch: document.getElementById('cllCaseSwitch'),
      searchNav: document.getElementById('cllSearchNav'),
      searchNavCount: document.getElementById('cllSearchNavCount'),
      searchPrevBtn: document.getElementById('cllSearchPrevBtn'),
      searchNextBtn: document.getElementById('cllSearchNextBtn'),
      statTotal: document.getElementById('cllStatTotal'),
      statDays: document.getElementById('cllStatDays'),
      statSince: document.getElementById('cllStatSince'),
      scroll: document.getElementById('cllScroll'),
      scrollInner: document.getElementById('cllScrollInner'),
      emptyHint: document.getElementById('cllEmptyHint'),
      noResHint: document.getElementById('cllNoResHint'),
      noResQuery: document.getElementById('cllNoResQuery'),
      toBottomBtn: document.getElementById('cllToBottomBtn')
    };

    /* ---- 搜索筛选状态：发送方 / 大小写敏感 —— 与关键词联动过滤 ---- */
    var searchState = {
      fromFilter: 'all',   // all | me | peer
      caseSensitive: false,
      matches: [],         // 当前命中的 .crm-bubble-inner 节点列表（按时间顺序）
      matchIndex: -1        // 当前定位到第几条（0-based）
    };

    els.peerLine.textContent = '与「' + (session.name || '好友') + '」的完整对话';

    var myAvatarUrl = null;
    var myName = '我';
    var msgGroupSeq = 0;
    var fullList = [];

    applyPeerAvatarFallbackName(session);
    loadIdentity().then(function (identity) {
      if (identity) { myAvatarUrl = identity.avatar || null; myName = identity.name || '我'; }
    });

    var storeKey = 'chatroom:' + (session.charId != null ? ('char-' + session.charId) : ('name-' + session.name));

    /* ---- 状态栏同步：与 chatroom.js / chatsetting.js 完全一致的读取方式 ---- */
    function syncStatusBar() {
      var timeEl = document.getElementById('statusTime');
      var pctEl = document.getElementById('batPct');
      var innerEl = document.getElementById('batInner');
      if (timeEl) {
        var tz = 'Asia/Shanghai';
        try { tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai'; } catch (e) {}
        var now = new Date();
        timeEl.textContent = now.toLocaleTimeString('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
      }
      if (pctEl && innerEl) {
        var pct = 76;
        try {
          var saved = localStorage.getItem('luna_battery');
          if (saved !== null && !isNaN(parseInt(saved, 10))) {
            pct = Math.max(1, Math.min(100, parseInt(saved, 10)));
          }
        } catch (e) {}
        pctEl.textContent = pct;
        innerEl.style.width = pct + '%';
      }
    }
    syncStatusBar();
    setInterval(syncStatusBar, 30000);

    /* ---- 灵动岛同步：与 chatsetting.js 的 applyIsland() 完全一致 ---- */
    (function () {
      var islandTimer = null;
      function applyIsland() {
        var el = document.getElementById('statusIsland');
        if (!el) return;
        var enabled = false;
        var style = 'minimal';
        try {
          enabled = localStorage.getItem('luna_island_enabled') === 'true';
          style = localStorage.getItem('luna_island_style') || 'minimal';
        } catch (e) {}
        if (!enabled) { el.innerHTML = ''; clearInterval(islandTimer); return; }
        var styleMap = {
          minimal: '<div class="si-minimal"><div class="si-capsule"></div></div>',
          glow:    '<div class="si-glow"><div class="si-capsule"></div></div>',
          clock:   '<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="cllSiClockText">--:--</span></div></div>',
          pulse:   '<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>',
          ripple:  '<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>',
          rainbow: '<div class="si-rainbow"><div class="si-capsule"></div></div>',
          music:   '<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>',
          scan:    '<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>'
        };
        el.innerHTML = styleMap[style] || styleMap.minimal;
        clearInterval(islandTimer);
        if (style === 'clock') {
          var tick = function () {
            var t = document.getElementById('cllSiClockText');
            if (!t) return;
            var now = new Date();
            t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
          };
          tick();
          islandTimer = setInterval(tick, 10000);
        }
      }
      applyIsland();
      window.addEventListener('storage', function (e) {
        if (e.key === 'luna_island_update' || e.key === 'luna_island_enabled' || e.key === 'luna_island_style') {
          applyIsland();
        }
      });
    })();

    if (els.backBtn) {
      els.backBtn.addEventListener('click', function () {
        if (window.history.length > 1) window.history.back();
        else window.location.href = 'chatsetting.html';
      });
    }

    /* ---- 数据加载与渲染 ---- */
    function loadAndRender() {
      loadMessages(storeKey).then(function (list) {
        fullList = list || [];
        renderStats(fullList);
        renderAll(fullList, els, session);
        applySearchFilter(els.searchInput.value.trim());
        if (!els.searchBar.classList.contains('is-open')) {
          scrollToBottom(els, false);
        }
      });
    }
    loadAndRender();

    /* ---- 重新可见时刷新一次，保证从聊天室回来后是最新数据 ---- */
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) loadAndRender();
    });
    window.addEventListener('pageshow', function () { loadAndRender(); });

    /* ---- 概览牙牌：消息总数 / 往来天数 / 最早记录 ---- */
    function renderStats(list) {
      els.statTotal.textContent = String(list.length);
      if (!list.length) {
        els.statDays.textContent = '0';
        els.statSince.textContent = '—';
        return;
      }
      var dayKeys = {};
      list.forEach(function (m) {
        var d = new Date(m.ts);
        dayKeys[d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate()] = true;
      });
      els.statDays.textContent = String(Object.keys(dayKeys).length);
      var first = new Date(list[0].ts);
      els.statSince.textContent = formatShortDate(first);
    }

    /* ---- 搜索：展开/收起 ---- */
    function setSearchOpen(open) {
      els.searchBar.classList.toggle('is-open', open);
      els.searchBtn.classList.toggle('is-active', open);
      document.body.classList.toggle('cll-search-open', open);
      if (open) {
        requestAnimationFrame(function () { els.searchInput.focus(); syncSearchExtraHeight(); });
      } else {
        els.searchInput.value = '';
        els.searchOpts.hidden = true;
        els.searchOptBtn.classList.remove('is-active');
        els.searchOptBtn.setAttribute('aria-expanded', 'false');
        applySearchFilter('');
        syncSearchExtraHeight();
      }
    }
    els.searchBtn.addEventListener('click', function () {
      setSearchOpen(!els.searchBar.classList.contains('is-open'));
    });
    els.searchInput.addEventListener('input', function () {
      els.searchClear.hidden = !els.searchInput.value;
      applySearchFilter(els.searchInput.value.trim());
    });
    els.searchInput.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (e.shiftKey) gotoMatch(-1); else gotoMatch(1);
    });
    els.searchClear.addEventListener('click', function () {
      els.searchInput.value = '';
      els.searchClear.hidden = true;
      els.searchInput.focus();
      applySearchFilter('');
    });

    /* ---- 高级筛选面板：折叠展开 ---- */
    els.searchOptBtn.addEventListener('click', function () {
      var open = els.searchOpts.hidden;
      els.searchOpts.hidden = !open;
      els.searchOptBtn.classList.toggle('is-active', open);
      els.searchOptBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      requestAnimationFrame(syncSearchExtraHeight);
    });

    /* ---- 发送方筹码：全部 / 我 / 对方 ---- */
    els.fromChips.addEventListener('click', function (e) {
      var chip = e.target.closest('.cll-opt-chip');
      if (!chip) return;
      searchState.fromFilter = chip.getAttribute('data-from');
      els.fromChips.querySelectorAll('.cll-opt-chip').forEach(function (c) {
        c.classList.toggle('is-active', c === chip);
      });
      applySearchFilter(els.searchInput.value.trim());
    });

    /* ---- 大小写敏感开关 ---- */
    function toggleCaseSwitch() {
      searchState.caseSensitive = !searchState.caseSensitive;
      els.caseSwitch.setAttribute('aria-checked', searchState.caseSensitive ? 'true' : 'false');
      applySearchFilter(els.searchInput.value.trim());
    }
    els.caseSwitch.addEventListener('click', toggleCaseSwitch);
    els.caseSwitch.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCaseSwitch(); }
    });

    /* ---- 结果导航：上一条 / 下一条命中，自动滚动定位并做柔和脉冲提示 ---- */
    els.searchPrevBtn.addEventListener('click', function () { gotoMatch(-1); });
    els.searchNextBtn.addEventListener('click', function () { gotoMatch(1); });

    function gotoMatch(dir) {
      var n = searchState.matches.length;
      if (!n) return;
      searchState.matchIndex = (searchState.matchIndex + dir + n) % n;
      focusCurrentMatch();
    }

    function focusCurrentMatch() {
      var n = searchState.matches.length;
      if (!n || searchState.matchIndex < 0) return;
      els.scrollInner.querySelectorAll('.cll-hit-mark.is-current').forEach(function (m) {
        m.classList.remove('is-current');
      });
      var node = searchState.matches[searchState.matchIndex];
      if (!node) return;
      var mark = node.querySelector('.cll-hit-mark');
      if (mark) mark.classList.add('is-current');
      var bubble = node.closest('.crm-bubble');
      if (bubble) {
        var bubbleRect = bubble.getBoundingClientRect();
        var scrollRect = els.scroll.getBoundingClientRect();
        var targetTop = els.scroll.scrollTop + (bubbleRect.top - scrollRect.top) - (scrollRect.height / 2) + (bubbleRect.height / 2);
        els.scroll.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
        bubble.classList.remove('cll-jump-pulse');
        void bubble.offsetWidth;
        bubble.classList.add('cll-jump-pulse');
      }
      els.searchNavCount.textContent = (searchState.matchIndex + 1) + ' / ' + n;
    }

    /* ---- 搜索条展开高度随高级面板/导航条动态变化，联动概览牙牌与滚动区上移 ---- */
    function syncSearchExtraHeight() {
      var extra = els.searchOpts.hidden ? 0 : els.searchOpts.offsetHeight + 8;
      if (!els.searchNav.hidden) extra += els.searchNav.offsetHeight + 8;
      document.documentElement.style.setProperty('--cll-search-extra', extra + 'px');
    }

    /* ---- 搜索过滤：纯本地文本匹配，只切换已渲染节点的显隐，
       不重新渲染 DOM，保证输入过程丝滑无卡顿。支持发送方筛选、
       大小写敏感，并维护一份按时间顺序排列的命中列表供上一条/
       下一条导航使用 ---- */
    function applySearchFilter(query) {
      var groups = els.scrollInner.querySelectorAll('.crm-msg-group');
      var dateSeals = els.scrollInner.querySelectorAll('.crm-date-seal-row');

      groups.forEach(function (g) { g.querySelectorAll('.cll-hit-mark').forEach(unmarkNode); });
      searchState.matches = [];
      searchState.matchIndex = -1;

      var fromFilter = searchState.fromFilter;
      var hasFromFilter = fromFilter !== 'all';

      if (!query) {
        groups.forEach(function (g) {
          var isMe = g.classList.contains('is-me');
          var passFrom = !hasFromFilter || (fromFilter === 'me' ? isMe : !isMe);
          g.classList.toggle('cll-filtered-out', !passFrom);
        });
        dateSeals.forEach(function (s) { s.classList.remove('cll-filtered-out'); });
        recomputeVisibleDateSeals(groups, dateSeals);
        els.searchNav.hidden = true;
        els.noResHint.hidden = true;
        els.emptyHint.style.display = fullList.length ? 'none' : 'flex';
        syncSearchExtraHeight();
        return;
      }

      els.emptyHint.style.display = 'none';
      var cs = searchState.caseSensitive;
      var q = cs ? query : query.toLowerCase();
      var visibleDateKeys = {};

      groups.forEach(function (g) {
        var isMe = g.classList.contains('is-me');
        var passFrom = !hasFromFilter || (fromFilter === 'me' ? isMe : !isMe);
        var bubbles = g.querySelectorAll('.crm-bubble-inner');
        var hit = false;
        bubbles.forEach(function (b) {
          var raw = b.getAttribute('data-raw-text') || b.textContent;
          var haystack = cs ? raw : raw.toLowerCase();
          if (passFrom && haystack.indexOf(q) !== -1) {
            hit = true;
            markHit(b, raw, query, cs);
            searchState.matches.push(b);
          } else {
            b.textContent = raw;
          }
        });
        g.classList.toggle('cll-filtered-out', !(hit && passFrom));
        if (hit && passFrom) visibleDateKeys[g.getAttribute('data-date-key')] = true;
      });

      dateSeals.forEach(function (s) {
        s.classList.toggle('cll-filtered-out', !visibleDateKeys[s.getAttribute('data-date-key')]);
      });

      var matchCount = searchState.matches.length;
      els.noResHint.hidden = matchCount > 0;
      if (!matchCount) els.noResQuery.textContent = query;

      if (matchCount) {
        els.searchNav.hidden = false;
        searchState.matchIndex = 0;
        els.searchPrevBtn.disabled = matchCount < 2;
        els.searchNextBtn.disabled = matchCount < 2;
        focusCurrentMatch();
      } else {
        els.searchNav.hidden = true;
      }
      syncSearchExtraHeight();
    }

    /* ---- 无查询词但存在发送方筛选时，仍需按可见消息组重算日期徽记显隐 ---- */
    function recomputeVisibleDateSeals(groups, dateSeals) {
      var visibleDateKeys = {};
      groups.forEach(function (g) {
        if (!g.classList.contains('cll-filtered-out')) visibleDateKeys[g.getAttribute('data-date-key')] = true;
      });
      dateSeals.forEach(function (s) {
        s.classList.toggle('cll-filtered-out', !visibleDateKeys[s.getAttribute('data-date-key')]);
      });
    }

    function markHit(node, raw, query, caseSensitive) {
      var haystack = caseSensitive ? raw : raw.toLowerCase();
      var needle = caseSensitive ? query : query.toLowerCase();
      var idx = haystack.indexOf(needle);
      if (idx === -1) { node.textContent = raw; return; }
      node.textContent = '';
      node.setAttribute('data-raw-text', raw);
      if (idx > 0) node.appendChild(document.createTextNode(raw.slice(0, idx)));
      var mark = document.createElement('span');
      mark.className = 'cll-hit-mark';
      mark.textContent = raw.slice(idx, idx + query.length);
      node.appendChild(mark);
      if (idx + query.length < raw.length) node.appendChild(document.createTextNode(raw.slice(idx + query.length)));
    }
    function unmarkNode(mark) {
      var node = mark.parentElement;
      if (!node) return;
      var raw = node.getAttribute('data-raw-text');
      if (raw != null) node.textContent = raw;
    }

    /* ---- 回到底部悬浮钮：滚动偏离底部一定距离后浮现 ---- */
    els.scroll.addEventListener('scroll', function () {
      var distFromBottom = els.scroll.scrollHeight - els.scroll.scrollTop - els.scroll.clientHeight;
      els.toBottomBtn.classList.toggle('is-visible', distFromBottom > 220 && fullList.length > 0);
    }, { passive: true });
    els.toBottomBtn.addEventListener('click', function () { scrollToBottom(els, true); });

    /* ==========================================================================
       渲染：与 chatroom.js 的 renderAll / buildDateSeal / buildMsgGroup
       结构对齐，额外挂 data-date-key，供搜索过滤按日期徽记联动显隐
    ========================================================================== */
    function renderAll(list, els, session) {
      var inner = els.scrollInner;
      inner.querySelectorAll('.crm-date-seal-row, .crm-msg-group').forEach(function (n) { n.remove(); });

      if (!list || !list.length) {
        els.emptyHint.style.display = 'flex';
        return;
      }
      els.emptyHint.style.display = 'none';

      var lastDateKey = null;
      var i = 0;
      while (i < list.length) {
        var msg = list[i];
        var d = new Date(msg.ts);
        var dateKey = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
        if (dateKey !== lastDateKey) {
          var seal = buildDateSeal(d);
          seal.setAttribute('data-date-key', dateKey);
          inner.appendChild(seal);
          lastDateKey = dateKey;
        }
        var group = [msg];
        var j = i + 1;
        while (j < list.length && list[j].from === msg.from) {
          var dj = new Date(list[j].ts);
          var dayKeyJ = dj.getFullYear() + '-' + dj.getMonth() + '-' + dj.getDate();
          if (dayKeyJ !== dateKey) break;
          group.push(list[j]);
          j++;
        }
        var groupEl = buildMsgGroup(group, session);
        groupEl.setAttribute('data-date-key', dateKey);
        inner.appendChild(groupEl);
        i = j;
      }
    }

    function buildDateSeal(d) {
      var row = document.createElement('div');
      row.className = 'crm-date-seal-row';
      var seal = document.createElement('div');
      seal.className = 'crm-date-seal';

      var num = document.createElement('span');
      num.className = 'crm-date-seal-num';
      num.textContent = String(d.getDate()).padStart(2, '0');

      var divider = document.createElement('span');
      divider.className = 'crm-date-seal-divider';

      var text = document.createElement('span');
      text.className = 'crm-date-seal-text';
      text.textContent = formatFullDate(d);

      var sub = document.createElement('span');
      sub.className = 'crm-date-seal-sub';
      sub.textContent = formatWeekdayEn(d);

      seal.appendChild(num);
      seal.appendChild(divider);
      seal.appendChild(text);
      seal.appendChild(sub);
      row.appendChild(seal);
      return row;
    }

    function buildMsgGroup(msgs, session) {
      var isMe = msgs[0].from === 'me';
      var group = document.createElement('div');
      group.className = 'crm-msg-group' + (isMe ? ' is-me' : '');

      var avatarWrap = document.createElement('div');
      avatarWrap.className = 'crm-msg-avatar-wrap';

      var avatar = document.createElement('div');
      avatar.className = 'crm-msg-avatar';
      if (isMe && myAvatarUrl) {
        var img = document.createElement('img'); img.src = myAvatarUrl; img.alt = '';
        avatar.appendChild(img);
      } else if (!isMe && session.avatar) {
        var img2 = document.createElement('img'); img2.src = session.avatar; img2.alt = '';
        avatar.appendChild(img2);
      } else {
        var glyph = document.createElement('span');
        glyph.className = 'crm-msg-avatar-glyph';
        glyph.textContent = isMe ? (myName || '我').charAt(0) : (session.name || '?').charAt(0);
        avatar.appendChild(glyph);
      }
      var ring = document.createElement('span');
      ring.className = 'crm-msg-avatar-ring';
      var moonMaskId = 'cllMoonMask' + (msgGroupSeq++);
      ring.innerHTML =
        '<svg class="crm-avatar-moon-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<circle class="crm-avatar-moon-track" cx="24" cy="24" r="21.5"/>' +
          '<circle class="crm-avatar-moon-badge-plate" cx="37" cy="37" r="9.5"/>' +
          '<mask id="' + moonMaskId + '">' +
            '<rect x="0" y="0" width="48" height="48" fill="#fff"/>' +
            '<circle cx="40.2" cy="33.6" r="6.6" fill="#000"/>' +
          '</mask>' +
          '<circle class="crm-avatar-moon-crescent" cx="37" cy="37" r="7.6" mask="url(#' + moonMaskId + ')"/>' +
        '</svg>';
      avatarWrap.appendChild(avatar);
      avatarWrap.appendChild(ring);

      var col = document.createElement('div');
      col.className = 'crm-msg-col';

      var stream = document.createElement('div');
      stream.className = 'crm-bubble-stream';

      msgs.forEach(function (msg, idx) {
        var bubble = document.createElement('div');
        bubble.className = 'crm-bubble' + (msg.text && msg.text.length > 60 ? ' has-divider' : '');
        if (idx === 0) bubble.classList.add('is-first');
        if (idx === msgs.length - 1) bubble.classList.add('is-last');
        bubble.setAttribute('data-msg-ts', String(msg.ts));
        bubble.setAttribute('data-msg-from', msg.from);

        var inner = document.createElement('div');
        inner.className = 'crm-bubble-inner';
        inner.textContent = msg.text;
        bubble.appendChild(inner);
        /* 只读页面：不挂点击选择菜单，气泡本身不响应点击交互 */

        var time = document.createElement('div');
        time.className = 'crm-msg-time';
        time.textContent = formatAmPm(new Date(msg.ts));

        var wrap = document.createElement('div');
        wrap.className = 'crm-bubble-wrap';
        wrap.appendChild(bubble);
        wrap.appendChild(time);
        stream.appendChild(wrap);
      });

      col.appendChild(stream);
      group.appendChild(avatarWrap);
      group.appendChild(col);

      requestAnimationFrame(function () {
        var streamH = stream.offsetHeight;
        if (!streamH) return;
        var mapH = Math.max(streamH, 220);
        stream.style.setProperty('--crm-stream-h', mapH + 'px');
        var bubbles = stream.querySelectorAll('.crm-bubble');
        var streamTop = stream.getBoundingClientRect().top;
        bubbles.forEach(function (b) {
          var offsetY = b.getBoundingClientRect().top - streamTop;
          b.style.setProperty('--crm-stream-h', mapH + 'px');
          b.style.setProperty('--crm-stream-y', (-offsetY) + 'px');
        });
      });

      return group;
    }

    function applyPeerAvatarFallbackName() { /* 头像仅在气泡内渲染，顶栏本页不展示对方头像徽记 */ }
  }

  function scrollToBottom(els, smooth) {
    requestAnimationFrame(function () {
      els.scroll.scrollTo({ top: els.scroll.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    });
  }

  /* ---- 会话令牌读取：与 chatroom.js 完全一致 ---- */
  function readSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !data.name) return null;
      return data;
    } catch (e) { return null; }
  }

  /* ---- LunaDB 读写：与 chatroom.js 共用同一个 IndexedDB(luna_chat_db / kv) ---- */
  function loadMessages(key) {
    if (window.LunaDB) return window.LunaDB.get(key).then(function (v) { return v || []; });
    return Promise.resolve([]);
  }
  function loadIdentity() {
    if (window.LunaDB) return window.LunaDB.get('identity');
    return Promise.resolve(null);
  }

  function formatAmPm(d) {
    var h = d.getHours();
    var m = String(d.getMinutes()).padStart(2, '0');
    var ap = h < 12 ? 'AM' : 'PM';
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + ':' + m + ' ' + ap;
  }
  function formatFullDate(d) {
    var y = d.getFullYear();
    var mo = String(d.getMonth() + 1).padStart(2, '0');
    var da = String(d.getDate()).padStart(2, '0');
    return y + '.' + mo + '.' + da;
  }
  function formatShortDate(d) {
    var mo = String(d.getMonth() + 1).padStart(2, '0');
    var da = String(d.getDate()).padStart(2, '0');
    return mo + '.' + da;
  }
  function formatWeekdayEn(d) {
    var names = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return names[d.getDay()];
  }
})();