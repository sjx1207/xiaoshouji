/* ==========================================================================
   Friend Profile Overlay — friend-profile.js
   好友资料展示页交互逻辑：
   - 仅能通过好友页 .flist-item 点击进入，不提供其它入口
   - 状态栏时间/电量与 chat.js 主状态栏读取同一份 localStorage，保持同步
   - 人设/性格类字段全程不读取、不展示——本文件从未读取角色档案里的
     prompt / desc / world 等人设字段，仅取 cardBg 作为背景图来源
   - 顶部肖像背景与「角色档案」（characters.js / LunaCharDB）联动：
     好友若关联了角色（charId），优先读取该角色在角色档案里设置的
     背景图（cardBg）；角色未设置背景图、或该好友未关联任何角色时，
     才回退到好友自身头像铺底 → 再回退到色阶渐变占位，
     与 characters.js 的 openView() 背景取值优先级保持一致
========================================================================== */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') init();

  /* ---- 与 characters.js 完全一致的色阶表：找不到背景图时，
     用同一套配色兜底，保证好友页与角色档案页视觉语言统一 ---- */
  var COLOR_MAP = {
    ink:    { strip: 'linear-gradient(180deg,#3a3a40,#16161a)', avBg:'#101012', avCol:'#c9c9cd' },
    slate:  { strip: 'linear-gradient(180deg,#7a7a82,#54545c)', avBg:'#141416', avCol:'#b8bac0' },
    silver: { strip: 'linear-gradient(180deg,#b8b8bc,#8c8c92)', avBg:'#1a1a1c', avCol:'#d4d4d8' },
    frost:  { strip: 'linear-gradient(180deg,#c4c8cc,#9aa0a6)', avBg:'#111316', avCol:'#c8ccd0' },
    smoke:  { strip: 'linear-gradient(180deg,#6a6a70,#3c3c42)', avBg:'#0e0e10', avCol:'#bdbdc2' },
    pearl:  { strip: 'linear-gradient(180deg,#d6d6d8,#adadb2)', avBg:'#1c1c1e', avCol:'#e0e0e3' }
  };

  /* ---- LunaCharDB 只读访问：与 characters.js 使用同一个数据库/store，
     此处仅做读取，不做建库/建 store（角色档案页面已负责建库；
     若用户从未打开过角色档案页、数据库尚不存在，则安全地返回空表，
     好友资料页整体回退到色阶占位，不报错、不影响其它功能） ---- */
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
      // 数据库尚不存在时会触发 upgrade——此处不建 store，直接判空返回，
      // 避免与 characters.js 的建库逻辑产生版本冲突
      req.onupgradeneeded = function (e) {
        e.target.transaction.abort();
      };
    }).catch(function () { return null; });
  }

  function getCharById(charId) {
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

  function init() {
    var overlay = document.getElementById('fpOverlay');
    var listEl = document.getElementById('friendsList');
    if (!overlay || !listEl) return;

    var backBtn = document.getElementById('fpBackBtn');
    var scrollEl = document.getElementById('fpScroll');

    var heroPhoto = document.getElementById('fpHeroPhoto');
    var heroAvatar = document.getElementById('fpHeroAvatar');
    var heroName = document.getElementById('fpHeroName');
    var heroBadge = document.getElementById('fpHeroBadge');
    var heroStatusDot = document.getElementById('fpHeroStatusDot');
    var heroStatusText = document.getElementById('fpHeroStatusText');
    var heroRelDot = document.getElementById('fpHeroRelDot');
    var heroRelation = document.getElementById('fpHeroRelation');
    var quoteCard = document.getElementById('fpQuoteCard');
    var quoteText = document.getElementById('fpQuoteText');
    var chatBtn = document.getElementById('fpChatBtn');
    var moreActionBtn = document.getElementById('fpMoreActionBtn');
    var moreBtn = document.getElementById('fpMoreBtn');
    var momentsAllBtn = document.getElementById('fpMomentsAllBtn');
    var circleCard = document.getElementById('fpCircleCard');
    var askBtn = document.getElementById('fpAskBtn');
    var mirrorBtn = document.getElementById('fpMirrorBtn');

    var lastFocused = null;
    var openToken = 0; // 防止异步查库回来时用户已切换到另一个好友，导致背景图串台

    /* ---- 事件委托：仅从好友清单区的 .flist-item 点击进入资料页，
       且必须点击到真实好友条目（而非分组头/空态），杜绝其它入口 ---- */
    listEl.addEventListener('click', function (evt) {
      var item = evt.target.closest ? evt.target.closest('.flist-item') : null;
      if (!item || !listEl.contains(item)) return;
      var friend = readFriendFromItem(item);
      if (!friend) return;
      openProfile(friend);
    });

    function readFriendFromItem(item) {
      var nameEl = item.querySelector('.flist-name');
      if (!nameEl) return null;
      var avatarImg = item.querySelector('.flist-avatar img');
      var badgeEl = item.querySelector('.flist-badge');
      var noteEl = item.querySelector('.flist-sub-text');
      var charIdAttr = item.getAttribute('data-char-id');
      return {
        name: nameEl.textContent || '',
        avatar: avatarImg ? avatarImg.getAttribute('src') : '',
        badge: badgeEl ? badgeEl.textContent : '',
        note: noteEl ? noteEl.textContent : '',
        online: item.getAttribute('data-online') === 'true',
        charId: charIdAttr ? Number(charIdAttr) : null
      };
    }

    /* ---- 顶部肖像背景：优先级为
       角色档案背景图(cardBg) → 角色档案头像(avatar) → 好友自身头像 → 色阶渐变占位
       与 characters.js 的 openView() 取值口径保持一致，
       确保「用户在角色档案里传的背景图」能真正同步显示到这里 ---- */
    function applyHeroBackground(friend, char) {
      var cardBg = char && char.cardBg;
      var fallbackAvatar = (char && char.avatar) || friend.avatar;
      var colorKey = (char && char.color) || 'ink';
      var col = COLOR_MAP[colorKey] || COLOR_MAP.ink;

      if (cardBg) {
        heroPhoto.classList.add('has-photo');
        heroPhoto.style.background = 'none';
        heroPhoto.innerHTML = '<img src="' + cardBg + '" alt="" />';
      } else if (fallbackAvatar) {
        // 没有专门设置背景图时，退而用头像铺满作背景，仍优于纯色占位
        heroPhoto.classList.add('has-photo');
        heroPhoto.style.background = 'none';
        heroPhoto.innerHTML = '<img src="' + fallbackAvatar + '" alt="" style="filter:saturate(0.9);" />';
      } else {
        heroPhoto.classList.remove('has-photo');
        heroPhoto.style.background = col.strip;
        heroPhoto.innerHTML = '<span class="fp-hero-photo-fallback" aria-hidden="true"></span>';
      }

      // 头像徽标：角色档案头像优先，其次好友自身头像，都没有则字母占位，
      // 底色同样跟随角色档案配色，与角色档案页头像底色语言一致
      if (fallbackAvatar) {
        heroAvatar.style.background = 'none';
        heroAvatar.innerHTML = '<img src="' + fallbackAvatar + '" alt="" />';
      } else {
        heroAvatar.style.background = col.avBg;
        var initial = (friend.name || '?').charAt(0);
        heroAvatar.innerHTML = '<span class="fp-hero-avatar-glyph" style="color:' + col.avCol + '">' + escapeHtml(initial) + '</span>';
      }
    }

    function openProfile(friend) {
      lastFocused = document.activeElement;
      openToken += 1;
      var myToken = openToken;

      // 供「进入聊天」按钮读取的会话数据快照：先用好友自身信息占位，
      // 若关联了角色档案背景图/头像，异步查库回来后再原地更新，
      // 确保聊天室顶栏头像与资料页保持一致（同一套优先级）
      overlay.setAttribute('data-current-friend', JSON.stringify({
        name: friend.name || '好友',
        avatar: friend.avatar || '',
        online: !!friend.online,
        color: 'ink',
        charId: friend.charId != null ? friend.charId : null
      }));

      heroName.textContent = friend.name || '好友';

      if (friend.badge) {
        heroBadge.textContent = friend.badge;
        heroBadge.classList.add('has-badge');
      } else {
        heroBadge.textContent = '';
        heroBadge.classList.remove('has-badge');
      }

      if (friend.online) {
        heroStatusDot.classList.add('is-online');
        heroStatusText.textContent = '在线';
      } else {
        heroStatusDot.classList.remove('is-online');
        heroStatusText.textContent = '离线';
      }

      if (friend.note) {
        heroRelation.textContent = friend.note;
        heroRelDot.classList.add('show');
      } else {
        heroRelation.textContent = '';
        heroRelDot.classList.remove('show');
      }

      // 寄语卡：复用关系备注作为寄语展示的兜底文案来源之一——
      // 若备注文本较长（更像一句寄语而非"恋人"这类短标签），
      // 则同时呈现在寄语卡中；短标签仅展示在身份行，不重复堆叠
      if (friend.note && friend.note.length >= 5) {
        quoteText.textContent = friend.note;
        quoteCard.classList.add('has-quote');
      } else {
        quoteText.textContent = '';
        quoteCard.classList.remove('has-quote');
      }

      // 背景图先按好友自身数据渲染一版，避免打开瞬间是空白；
      // 若该好友关联了角色，再异步查库、查到后原地覆盖（带 token 校验，
      // 防止用户已经切换查看另一个好友时，前一个查询才姗姗来迟串了台）
      applyHeroBackground(friend, null);
      if (friend.charId != null) {
        getCharById(friend.charId).then(function (char) {
          if (myToken !== openToken) return; // 已切换到别的好友，丢弃这次结果
          if (char) {
            applyHeroBackground(friend, char);
            overlay.setAttribute('data-current-friend', JSON.stringify({
              name: friend.name || '好友',
              avatar: char.avatar || friend.avatar || '',
              online: !!friend.online,
              color: char.color || 'ink',
              charId: friend.charId
            }));
          }
        });
      }

      syncStatusBar();
      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.add('fp-open');
      if (scrollEl) scrollEl.scrollTop = 0;
      document.body.style.overflow = 'hidden';
    }

    function closeProfile() {
      overlay.classList.remove('fp-open');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (lastFocused && typeof lastFocused.focus === 'function') {
        lastFocused.focus();
      }
    }

    if (backBtn) backBtn.addEventListener('click', closeProfile);

    // 覆盖层内其余入口均为占位：轻触反馈 + 控制台标注，
    // 不做任何假的跳转或弹窗，避免造成"已经实现"的误导
    [moreActionBtn, moreBtn, momentsAllBtn, circleCard, askBtn, mirrorBtn].forEach(function (btn) {
      if (!btn) return;
      btn.addEventListener('click', function () {
        btn.classList.add('fp-tap-flash');
        setTimeout(function () { btn.classList.remove('fp-tap-flash'); }, 220);
      });
    });

    /* ---- 「进入聊天」：唯一的聊天室入口。写入一次性会话令牌到
       sessionStorage 后跳转 chatroom.html；chatroom.js 仅信任该令牌，
       不提供其它写入路径，故聊天室无法被直接以 URL 打开 ---- */
    if (chatBtn) {
      chatBtn.addEventListener('click', function () {
        var currentFriend = overlay.getAttribute('data-current-friend');
        if (!currentFriend) return;
        chatBtn.classList.add('fp-tap-flash');
        try {
          sessionStorage.setItem('luna_chat_session', currentFriend);
        } catch (e) {}
        setTimeout(function () {
          window.location.href = 'chatroom.html';
        }, 120);
      });
    }

    /* ---- 状态栏时间/电量：与 chat.js 主状态栏读取同一份 localStorage，
       打开覆盖层时立即同步一次，并跟随主状态栏的 30 秒节奏刷新，
       避免出现"进入资料页后时间停在打开那一刻"的割裂感 ---- */
    function syncStatusBar() {
      var timeEl = document.getElementById('fpStatusTime');
      var pctEl = document.getElementById('fpBatPct');
      var innerEl = document.getElementById('fpBatInner');
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
    setInterval(function () {
      if (overlay.classList.contains('fp-open')) syncStatusBar();
    }, 30000);

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
  }
})();