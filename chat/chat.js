/* ==========================================================================
   Chat App — chat-script.js
   页面切换 · 底部导航指示器动画 · 状态栏时间/电量（与主系统逻辑同步）
========================================================================== */
(function () {
  'use strict';

  /* ==========================================================================
     本地数据库层 —— IndexedDB 简易 KV 封装
     用于持久化：顶栏头像/昵称、消息页照片堆叠（3 张）、消息页语录、
     好友页臻藏徽章（照片/昵称/寄语）、好友分组数据。
     替代原先"仅存于内存/DOM，刷新即丢失"的做法，且不受 localStorage
     的容量限制（图片以 dataURL 形式存入 IndexedDB，可容纳更大图片）。
  ========================================================================== */
  var LunaDB = (function () {
    var DB_NAME = 'luna_chat_db';
    var DB_VERSION = 1;
    var STORE = 'kv';
    var dbPromise = null;

    function open() {
      if (dbPromise) return dbPromise;
      dbPromise = new Promise(function (resolve, reject) {
        if (!window.indexedDB) { reject(new Error('indexedDB unsupported')); return; }
        var req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains(STORE)) {
            db.createObjectStore(STORE, { keyPath: 'key' });
          }
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
      return dbPromise;
    }

    function get(key) {
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(STORE, 'readonly');
          var store = tx.objectStore(STORE);
          var req = store.get(key);
          req.onsuccess = function () { resolve(req.result ? req.result.value : undefined); };
          req.onerror = function () { reject(req.error); };
        });
      }).catch(function () { return undefined; });
    }

    function set(key, value) {
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(STORE, 'readwrite');
          var store = tx.objectStore(STORE);
          var req = store.put({ key: key, value: value });
          req.onsuccess = function () { resolve(true); };
          req.onerror = function () { reject(req.error); };
        });
      }).catch(function () { return false; });
    }

    // 按 key 前缀批量读取（游标扫描），供消息页汇总所有会话
    // （chatroom:*）使用——无需事先知道有哪些好友开过聊天室，
    // 直接从 IndexedDB 里"倒" 出所有匹配前缀的记录即可。
    function getAll(prefix) {
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(STORE, 'readonly');
          var store = tx.objectStore(STORE);
          var req = store.openCursor();
          var out = [];
          req.onsuccess = function () {
            var cursor = req.result;
            if (!cursor) { resolve(out); return; }
            if (!prefix || String(cursor.value.key).indexOf(prefix) === 0) {
              out.push({ key: cursor.value.key, value: cursor.value.value });
            }
            cursor.continue();
          };
          req.onerror = function () { reject(req.error); };
        });
      }).catch(function () { return []; });
    }

    return { get: get, set: set, getAll: getAll };
  })();
  window.LunaDB = LunaDB;

  /* ==========================================================================
     跨标签页/跨页面消息变更广播 —— chatroom.js 每次发送新消息后调用
     window.LunaMessagesBus.notify()，消息页借此实时刷新会话预览，
     不必轮询。优先用 BroadcastChannel；不支持的环境退化为往
     localStorage 写一个时间戳触发 storage 事件，两端逻辑统一收敛到
     同一个 CustomEvent('luna:messages-changed') 上，方便本页监听。
  ========================================================================== */
  (function () {
    var PING_KEY = 'luna_messages_ping';
    var bc = null;
    try { if (window.BroadcastChannel) bc = new BroadcastChannel('luna_messages'); } catch (e) {}

    function fireLocal() {
      document.dispatchEvent(new CustomEvent('luna:messages-changed'));
    }

    if (bc) {
      bc.onmessage = function () { fireLocal(); };
    }
    window.addEventListener('storage', function (e) {
      if (e.key === PING_KEY) fireLocal();
    });

    window.LunaMessagesBus = {
      notify: function () {
        if (bc) { try { bc.postMessage({ ts: Date.now() }); } catch (e) {} }
        try { localStorage.setItem(PING_KEY, String(Date.now())); } catch (e) {}
        // 同一页面内（例如聊天室与列表共享同一个 chat.js 上下文时）
        // 也直接本地触发一次，不依赖 BroadcastChannel 的自身回环
        fireLocal();
      }
    };
  })();

  /* ==========================================================================
     收藏系统 —— window.LunaFavorites
     数据落盘于 LunaDB 的 'favorites:messages'（消息收藏，数组）与
     'favorites:moments'（动态收藏，数组，暂未启用），与聊天记录/
     好友分组共用同一个 IndexedDB（luna_chat_db / kv），不新建数据库。

     每条消息收藏记录结构：
       {
         id:          string   收藏记录自身的唯一 id（收藏时间戳+随机位）
         ts:          number   原消息发出时间戳（用于展示、以及可能的跳转定位）
         from:        'me' | 其它  原消息发送方
         text:        string   消息文本
         quote:       object|null  原消息若引用了别的消息，一并带上
         favoritedAt: number   收藏动作发生的时间戳（用于收藏列表排序）
         charId:      number|null 关联的角色档案 id（用于取角色背景图 cardBg）
         friendKey:   string   好友分组键：charId!=null ? 'char-'+charId : 'name-'+friendName，
                                与 chatroom.js 的 storeKey 后缀保持一致，用作分组依据
         friendName:  string   好友/角色昵称（收藏时的快照，角色改名不会回溯更新旧记录）
         friendAvatar:string   好友/角色头像（同上，快照）
         color:       string   好友色阶 key（无头像时的字母底色兜底，同上，快照）
       }

     广播机制与 LunaMessagesBus 同源：优先 BroadcastChannel，
     退化到 localStorage ping，统一收敛到 CustomEvent('luna:favorites-changed')，
     收藏页监听此事件后原地增删 DOM，无需刷新整页。
  ========================================================================== */
  (function () {
    var PING_KEY = 'luna_favorites_ping';
    var bc = null;
    try { if (window.BroadcastChannel) bc = new BroadcastChannel('luna_favorites'); } catch (e) {}

    function fireLocal() {
      document.dispatchEvent(new CustomEvent('luna:favorites-changed'));
    }
    if (bc) { bc.onmessage = function () { fireLocal(); }; }
    window.addEventListener('storage', function (e) {
      if (e.key === PING_KEY) fireLocal();
    });

    function notify() {
      if (bc) { try { bc.postMessage({ ts: Date.now() }); } catch (e) {} }
      try { localStorage.setItem(PING_KEY, String(Date.now())); } catch (e) {}
      fireLocal();
    }

    function genId() {
      return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    }

    function getMessageFavorites() {
      if (!window.LunaDB) return Promise.resolve([]);
      return LunaDB.get('favorites:messages').then(function (v) { return Array.isArray(v) ? v : []; });
    }

    // session 结构与 chatroom.js 的 session 完全一致：{ name, avatar, online, color, charId }
    function addMessageFavorite(msg, session) {
      return getMessageFavorites().then(function (list) {
        var friendKey = (session && session.charId != null) ? ('char-' + session.charId) : ('name-' + (session && session.name || '未知好友'));
        // 幂等：同一条原始消息（同 ts + from + friendKey）已收藏过则不重复添加
        var already = list.some(function (r) {
          return r.ts === msg.ts && r.from === msg.from && r.friendKey === friendKey;
        });
        if (already) return { ok: false, reason: 'duplicate' };

        list.push({
          id: genId(),
          ts: msg.ts,
          from: msg.from,
          text: msg.text || '',
          quote: msg.quote || null,
          favoritedAt: Date.now(),
          charId: (session && session.charId != null) ? session.charId : null,
          friendKey: friendKey,
          friendName: (session && session.name) || '未知好友',
          friendAvatar: (session && session.avatar) || '',
          color: (session && session.color) || 'ink'
        });
        return LunaDB.set('favorites:messages', list).then(function () {
          notify();
          return { ok: true };
        });
      });
    }

    function removeMessageFavorite(id) {
      return getMessageFavorites().then(function (list) {
        var next = list.filter(function (r) { return r.id !== id; });
        return LunaDB.set('favorites:messages', next).then(function () {
          notify();
          return true;
        });
      });
    }

    window.LunaFavorites = {
      getMessageFavorites: getMessageFavorites,
      addMessageFavorite: addMessageFavorite,
      removeMessageFavorite: removeMessageFavorite,
      notify: notify
    };
  })();

  /* ==========================================================================
     独立全屏覆盖层注册表 —— 表情包总览层 / 收藏总览层 / 好友资料层
     都与 .pages-root 平级（绝对定位铺满整个 phone-frame，z-index 更高），
     切换一级 tab 的逻辑天然不知道、也管不到这些覆盖层。若用户在某个
     覆盖层内部时点击底部 tab，覆盖层若不主动关闭，会继续以最高层级
     盖住新切入的页面，表现为"点了 tab 但画面没变、像卡住了一样"。

     用一个共享数组代替事件广播：每个覆盖层模块初始化时把自己的
     "如果开着就关闭"函数 push 进来，chat.js 切 tab 时直接遍历调用。
     比事件广播更直接可查——数组内容随时可以打印出来确认"到底注册
     上了几个"，不会出现"广播了但没人监听、且不报错"的隐性遗漏。
     chat.js 在所有覆盖层脚本之前加载，此处只需保证 tab 点击时
     （而非此刻）该数组已经填好即可，与脚本加载顺序无关。
  ========================================================================== */
  window.LunaOverlays = window.LunaOverlays || [];

  var PAGE_ORDER = ['messages', 'friends', 'moments', 'profile'];
  var PAGE_TITLES = {
    messages: '消息',
    friends: '好友',
    moments: '动态',
    profile: '我的'
  };
  var PAGE_EN = {
    messages: 'MESSAGES',
    friends: 'FRIENDS',
    moments: 'MOMENTS',
    profile: 'PROFILE'
  };

  var tabItems = Array.prototype.slice.call(document.querySelectorAll('.tab-item'));
  var pages = Array.prototype.slice.call(document.querySelectorAll('.page'));
  var topTitle = document.getElementById('topPageTitle');
  var topPageNum = document.getElementById('topPageNum');
  var topPageEn = document.getElementById('topPageEn');
  var topBackBar = document.getElementById('topBackBar');
  var topBackBtn = document.getElementById('topBackBtn');
  var tabRail = document.getElementById('tabRail');
  var topIdentityBtn = document.getElementById('topIdentityBtn');
  var friendAddSeal = document.getElementById('friendAddSeal');
  var momentsComposeSeal = document.getElementById('momentsSealGroup');

  var currentIndex = 0;

  function activatePage(name, opts) {
    opts = opts || {};
    var index = PAGE_ORDER.indexOf(name);
    if (index === -1) return;

    // ------------------------------------------------------------------
    // 强制清场：无论任何弹窗因为任何原因（时序、焦点、事件没触发、
    // 别的模块的 bug）残留在打开状态，切页时一律就地强制拍平，
    // 不做任何"是否应该关闭"的判断、不依赖任何模块自己的关闭函数、
    // 不依赖任何事件是否被触发。这里直接操作最原始的 DOM 属性，
    // 保证不管上游出了什么问题，导航本身永远不会被弹窗卡住。
    try {
      // 所有原生 <dialog>：只要还带着 open 属性，直接调用原生
      // close()（同步、无动画、无条件）。不判断是谁的、不判断
      // 之前状态，开着就关。
      document.querySelectorAll('dialog[open]').forEach(function (dlg) {
        try {
          if (document.activeElement && dlg.contains(document.activeElement)) {
            document.activeElement.blur();
          }
          dlg.close();
        } catch (e) {}
        dlg.classList.remove('is-open');
      });
      // 所有手写的全屏浮层（同时带 is-open 这个视觉 class 的元素）：
      // 直接清掉 is-open，并强制打上 aria-hidden + inert，物理层面
      // 保证它既不可见也不可交互，不依赖它自己内部任何一个变量。
      document.querySelectorAll('.is-open').forEach(function (el) {
        if (document.activeElement && el.contains(document.activeElement)) {
          document.activeElement.blur();
        }
        el.classList.remove('is-open');
      });
      // 最后一道保险：不管上面两类清理是否覆盖到了所有情况，
      // 只要某个元素此刻仍然铺满屏幕、盖在最上层（这正是"挡住
      // 导航、点哪里都没反应"的唯一表现形式），直接用内联样式
      // 强制把它按下去——不判断它是什么、属于哪个模块、该不该
      // 关，纯粹保证它这一刻起不再能拦截任何点击或遮挡任何页面。
      // 只对"确实还残留可见"的元素动手，不误伤正常隐藏的元素。
      document.querySelectorAll('dialog, .fav-overlay, .fav-char-detail, .fp-overlay').forEach(function (el) {
        var stillVisible = el.hasAttribute('open') || el.classList.contains('is-open');
        if (stillVisible) {
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('pointer-events', 'none', 'important');
          el.classList.remove('is-open');
          if (el.tagName === 'DIALOG') { try { el.close(); } catch (e) {} }
        } else {
          // 之前若被这段代码强制按下去过，这次确认它已经是关闭
          // 状态了，把内联样式清掉，避免以后想正常打开它时，这
          // 里残留的 !important 内联样式反而把它重新锁死在隐藏态。
          el.style.removeProperty('display');
          el.style.removeProperty('pointer-events');
        }
      });
    } catch (err) {
      console.error('[activatePage] 强制清场失败（不影响继续切页）：', err);
    }
    // ------------------------------------------------------------------

    var previousPage = PAGE_ORDER[currentIndex];
    opts.previousPage = previousPage;
    currentIndex = index;

    pages.forEach(function (p) {
      p.classList.toggle('page-active', p.dataset.page === name);
    });

    tabItems.forEach(function (t) {
      t.classList.toggle('tab-active', t.dataset.tab === name);
    });

    // 顶栏为全局共享组件，四个一级页面统一显示：居中页面标签 +
    // 右侧头像昵称（好友页换为加好友刻记）。不含返回按钮——
    // 一级 tab 页面之间是并列切换，没有"上一级"语义。
    if (topBackBar) {
      topBackBar.classList.remove('top-back-bar-hidden');
    }

    // 浮起纸片跟随选中项：不再用百分比猜测位置（会被台面 padding/gap
    // 带偏、在不同屏宽下累积误差、甚至整体错位到台面外造成大片留白），
    // 改为实测目标 .tab-item 相对 .tab-dock 的真实像素 left/width，
    // 直接写成内联样式，无论 padding、gap、屏宽如何变化都严丝合缝。
    if (tabRail) {
      var activeItem = tabItems[index];
      var dock = document.getElementById('tabDock');
      if (activeItem && dock) {
        var dockRect = dock.getBoundingClientRect();
        var itemRect = activeItem.getBoundingClientRect();
        tabRail.style.left = (itemRect.left - dockRect.left) + 'px';
        tabRail.style.width = itemRect.width + 'px';
      }
      var isSwitch = !opts.silent;
      tabRail.classList.toggle('pulse', false);
      if (isSwitch) {
        // 强制重排以便下次切换能重新触发同名动画类
        // （读取 offsetWidth 是最轻量的触发方式，不引入额外布局抖动）
        void tabRail.offsetWidth;
        tabRail.classList.add('pulse');
      }
    }

    if (topTitle) topTitle.textContent = PAGE_TITLES[name] || '';
    if (topPageNum) topPageNum.textContent = String(index + 1).padStart(2, '0');
    if (topPageEn) topPageEn.textContent = PAGE_EN[name] || '';

    // 顶栏右侧插槽：好友页显示加好友印玺，动态页显示落笔发布印记，
    // 其余页面显示头像昵称
    var onFriends = name === 'friends';
    var onMoments = name === 'moments';
    if (friendAddSeal) friendAddSeal.classList.toggle('slot-hidden', !onFriends);
    if (momentsComposeSeal) momentsComposeSeal.classList.toggle('slot-hidden', !onMoments);
    if (topIdentityBtn) topIdentityBtn.classList.toggle('slot-hidden', onFriends || onMoments);

    // 顶栏左侧：返回按钮仅在消息页出现（先占位，不绑定跳转逻辑，
    // 后续接入会话详情页时，可在此处替换为真正的返回动作）
    var onMessages = name === 'messages';
    if (topBackBtn) topBackBtn.classList.toggle('top-back-visible', onMessages);

    // 动态页专属：显示跨越状态栏/顶栏/封面的统一背景层（真实封面图或
    // 占位渐变均在此层绘制），状态栏与顶栏在其上完全透明，三者融为
    // 一整张画布，而非 content 区域内孤立的圆角色块
    var phoneFrame = document.querySelector('.phone-frame');
    if (phoneFrame) phoneFrame.classList.toggle('is-moments-chrome', name === 'moments');

    // 广播全局导航事件——chat.js 不需要知道有谁在监听、监听的
    // 模块要做什么。任何独立的覆盖层/弹窗模块（表情包、收藏、
    // 好友资料等）都可以自己订阅这个事件，在页面切走时自行判断
    // 要不要关闭、怎么关闭、怎么转移焦点，chat.js 全程不参与、
    // 也不需要认识任何具体模块的 DOM 结构。
    try {
      window.dispatchEvent(new CustomEvent('luna:page-change', {
        detail: { page: name, previousPage: opts.previousPage }
      }));
    } catch (err) {
      console.error('[luna:page-change] 广播导航事件失败：', err);
    }
  }

  /* ==========================================================================
     LunaOverlays —— 保留作为可选的通用注册表

     这里不再对收藏页（.fav-overlay、.fav-char-detail）、好友资料页
     （.fp-overlay）等任何具体模块的 DOM 结构做硬编码认知。原来的写法
     是主导航（chat.js）反过来知道并耦合每个子模块内部怎么实现弹窗——
     子模块随便改一下自己的 class 名或结构，主导航这边的兜底就悄悄
     失效，出问题时也很难联想到"罪魁祸首其实是 chat.js 里的一段
     选择器"。

     现在改为两种互补的、模块"自己选、自己负责"的接入方式：

     1. 广播 luna:page-change 事件（见下方 activatePage 内部）——
        任何模块只要监听这个事件，就能在页面切走时自己判断"我是不是
        还开着"、自己关闭、自己做焦点转移。推荐用这种方式。

     2. window.LunaOverlays 数组——仍然保留作为可选的"拉"模型注册表，
        模块可以往里 push 一个 { closeIfOpen() {...} }，chat.js 切
        tab 时会遍历调用。chat.js 自己永远不会往这个数组里塞任何
        东西，也不关心里面某一项具体是什么模块、该怎么处理，纯粹是
        "数组里注册了什么就都点名喊一遍"——继续保留只是为了兼容可能
        还在用这种旧接口的模块，而不是主导航反过来认识任何具体实现。
  ========================================================================== */
  window.LunaOverlays = window.LunaOverlays || [];

  tabItems.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var name = btn.dataset.tab;
      if (!name) return;
      // 关键：这里必须给每一个 closeIfOpen() 单独兜一层 try/catch。
      // LunaOverlays 数组会随着页面越做越多、越接越多模块进来，
      // 任何一个模块自己的关闭逻辑里哪怕只是一处疏漏（空指针、
      // 元素不存在等）抛出异常，如果不隔离，forEach 会被整体中断，
      // 直接导致下面 activatePage(name) 这行真正切页面的代码
      // 永远执行不到——表现出来就是"点了 tab 没反应，卡在原页面"，
      // 而且控制台里往往看不到明显提示（错误发生在事件回调里，
      // 容易被忽略）。一个弹窗自己没关好，绝不应该有能力拖垮
      // 整个底部导航，两者要严格隔离。
      window.LunaOverlays.forEach(function (ov) {
        try {
          if (ov && typeof ov.closeIfOpen === 'function') ov.closeIfOpen();
        } catch (err) {
          console.error('[LunaOverlays] 某个覆盖层关闭时报错，已跳过，不影响切页：', err);
        }
      });
      // activatePage 本身也兜一层，理由同上——切页动作是全局最基础的
      // 交互，任何意外都不该让它失效。activatePage 内部会广播
      // luna:page-change 事件，各模块自己监听、自己清理自己的
      // 弹窗/浮层，chat.js 不需要认识任何一个具体模块。
      try {
        activatePage(name);
      } catch (err) {
        console.error('[activatePage] 切页时报错：', err);
      }
    });
  });

  // 屏幕尺寸变化（旋转、响应式断点切换 tab-dock 高度等）时，
  // 纸片的像素位置需要重新计算，否则会停留在旧宽度下的位置。
  window.addEventListener('resize', function () {
    activatePage(PAGE_ORDER[currentIndex], { silent: true });
  });

  // 初始状态：静默激活，不触发墨环脉冲动画
  window.addEventListener('DOMContentLoaded', function () {
    activatePage('messages', { silent: true });
    updateTime();
    updateBattery();
  });
  if (document.readyState !== 'loading') {
    activatePage('messages', { silent: true });
    updateTime();
    updateBattery();
  }

  /* ---- 状态栏时间：与主系统 index.html 同步逻辑（24小时制） ---- */
  function updateTime() {
    var el = document.getElementById('statusTime');
    if (!el) return;
    var tz = 'Asia/Shanghai';
    try {
      tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
    } catch (e) {}
    var now = new Date();
    var statusTimeStr = now.toLocaleTimeString('zh-CN', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
    });
    el.textContent = statusTimeStr;
  }

  /* ---- 电量：读取主系统写入的电量值，无则保持默认展示 ---- */
  function updateBattery() {
    var pctEl = document.getElementById('batPct');
    var innerEl = document.getElementById('batInner');
    if (!pctEl || !innerEl) return;
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

  setInterval(updateTime, 30000);

  /* ==========================================================================
     消息列表 —— 左滑置顶 / 删除
     结构：.msg-row（裁切容器） > .msg-actions（固定动作层，宽度=两枚
     动作按钮之和） + .msg-surface（可拖拽表层卡片）。

     交互规则：
     - 拖拽仅对 .msg-surface 施加 translateX（transform-only，合成层），
       动作层本身不参与任何位移/重绘。
     - 松手时按位移量分三档判定：
         回弹到 0（滑动距离不足）
         停在“动作层宽度”处（滑动过半，保持动作条常驻，LINE 常见手感）
         超过强删阈值（继续用力滑到底）直接触发删除，带一次退场动画
     - 同一时刻只允许一条会话处于“已滑开”状态：滑开新的一条或点击
       空白处，会先把其余已滑开的会话收回。
     - 点击置顶：将该行的 data-pinned 置为 true/false 并同步移动 DOM
       到“置顶”分组或“全部消息”分组，随后收回滑动状态。
     - 点击删除：先播放高度坍缩退场动画，动画结束后再真正从 DOM 移除，
       避免其余卡片瞬间跳动。
  ========================================================================== */
  var MsgListController = (function initSwipeableMessages() {
    var pinnedList = document.getElementById('msgList');
    var mainList = document.getElementById('msgListMain');
    var allCountEl = document.getElementById('msgAllCount');
    var blankEl = document.getElementById('msgBlank');
    var emptyHintEl = document.getElementById('msgEmptyHint');
    if (!pinnedList || !mainList) return null;

    var ACTIONS_WIDTH = 136; // 动作层可见总宽：左右内边距(6+10) + 两枚 56px 按钮 + 8px 间距，需与 CSS .msg-actions 保持一致
    var COMMIT_RATIO = 0.35; // 松手时超过该比例即视为"滑动过半"，动作层保持展开
    // 注意：左滑不再有"强删"分支——无论滑动多远，松手后最多只会停在
    // 动作层完全展开处，绝不会仅凭滑动距离就直接删除会话。
    // 真正的删除必须显式点击"删除"按钮（见下方 .msg-action-delete 监听）。
    var MAX_DRAG_MULT = 1.12; // 允许略微超出动作层宽度的橡皮筋手感上限

    var openRow = null; // 当前处于滑开状态的 .msg-row

    function getSurface(row) { return row.querySelector('.msg-surface'); }

    function closeRow(row, animate) {
      if (!row) return;
      var surface = getSurface(row);
      if (!surface) return;
      if (animate === false) surface.style.transition = 'none';
      surface.style.transform = 'translate3d(0,0,0)';
      row.classList.remove('swiped-full');
      if (animate === false) {
        void surface.offsetWidth;
        surface.style.transition = '';
      }
      if (openRow === row) openRow = null;
    }

    function closeOpenRow() {
      if (openRow) closeRow(openRow);
    }

    function setSurfaceX(surface, x) {
      surface.style.transform = 'translate3d(' + x + 'px,0,0)';
    }

    // 统一刷新："全部消息"计数、空态显示/隐藏、底部滑动提示的显隐，
    // 三者都取决于当前会话总数，因此合并成一个函数，任何增删操作后调用即可
    function refreshListState() {
      var total = pinnedList.querySelectorAll('.msg-row').length + mainList.querySelectorAll('.msg-row').length;
      if (allCountEl) allCountEl.textContent = total + ' 位';
      var hasAny = total > 0;
      if (blankEl) blankEl.style.display = hasAny ? 'none' : '';
      if (emptyHintEl) emptyHintEl.style.display = hasAny ? '' : 'none';
    }

    function movePin(row, pinned) {
      row.dataset.pinned = pinned ? 'true' : 'false';
      var pinBtnLabel = row.querySelector('.msg-action-pin span');
      if (pinBtnLabel) pinBtnLabel.textContent = pinned ? '取消置顶' : '置顶';
      var targetList = pinned ? pinnedList : mainList;
      // 置顶插入到该分组最前；取消置顶则放到"全部消息"分组最前
      targetList.insertBefore(row, targetList.firstChild);
      refreshListState();
    }

    function deleteRow(row) {
      // 高度坍缩退场：先量出当前高度再动画到 0，避免其余行瞬间跳动
      var h = row.getBoundingClientRect().height;
      row.style.height = h + 'px';
      row.style.overflow = 'hidden';
      void row.offsetHeight;
      row.style.transition = 'height 0.32s cubic-bezier(.4,0,.2,1), opacity 0.28s ease, margin 0.32s ease';
      row.style.opacity = '0';
      row.style.height = '0px';
      row.style.marginBottom = '0px';
      row.addEventListener('transitionend', function onEnd(e) {
        if (e.propertyName !== 'height') return;
        row.removeEventListener('transitionend', onEnd);
        row.remove();
        refreshListState();
      });
    }

    // 单条 .msg-row 的滑动/置顶/删除交互绑定，抽成可复用函数——
    // 新渲染出的会话行（来自真实消息数据）与旧的静态行走同一套逻辑，
    // 避免重复维护两份手势代码
    function wireRow(row) {
      if (row._wired) return;
      row._wired = true;
      var surface = getSurface(row);
      if (!surface) return;

      var startX = 0, startY = 0, currentX = 0, dragging = false, axisLocked = null, pointerId = null;

      function onPointerDown(e) {
        // 若点在动作按钮或已展开状态下点在卡片上，交给对应处理器
        if (e.target.closest && e.target.closest('.msg-action')) return;
        var point = e.touches ? e.touches[0] : e;
        startX = point.clientX;
        startY = point.clientY;
        currentX = row.classList.contains('swiped-full') ? -ACTIONS_WIDTH : 0;
        dragging = true;
        axisLocked = null;
        row.classList.add('dragging');
        if (e.pointerId !== undefined) {
          pointerId = e.pointerId;
          surface.setPointerCapture && surface.setPointerCapture(pointerId);
        }
      }

      function onPointerMove(e) {
        if (!dragging) return;
        var point = e.touches ? e.touches[0] : e;
        var dx = point.clientX - startX;
        var dy = point.clientY - startY;

        if (axisLocked === null) {
          if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
          axisLocked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
          if (axisLocked === 'y') { dragging = false; row.classList.remove('dragging'); return; }
          // 横向手势确认后，先收起其它已展开的会话
          if (openRow && openRow !== row) closeRow(openRow);
        }
        if (axisLocked !== 'x') return;

        e.preventDefault && e.cancelable && e.preventDefault();

        var next = currentX + dx;
        // 只允许向左滑（负值），并允许向右回弹超出 0 一点点的橡皮筋感
        if (next > 0) next = next * 0.28; // 右侧越界，做轻微阻尼
        // 左侧同样做阻尼限位：无论用力滑多远，都不会超过动作层宽度太多，
        // 也不存在"滑到底即删除"的隐藏阈值。
        var maxLeft = -ACTIONS_WIDTH * MAX_DRAG_MULT;
        if (next < maxLeft) next = maxLeft + (next - maxLeft) * 0.22;

        setSurfaceX(surface, next);
        row._dragX = next;
      }

      function onPointerUp() {
        if (!dragging) return;
        dragging = false;
        row.classList.remove('dragging');
        if (pointerId !== null) {
          try { surface.releasePointerCapture(pointerId); } catch (err) {}
          pointerId = null;
        }
        if (axisLocked !== 'x') { axisLocked = null; return; }
        axisLocked = null;

        var dragX = row._dragX || 0;
        var ratio = Math.abs(dragX) / ACTIONS_WIDTH;

        // 松手后只有两种结局：回弹关闭，或停在动作层完全展开处。
        // 无论滑动力度多大、距离多远，都不会在这里触发删除。
        if (ratio >= COMMIT_RATIO) {
          setSurfaceX(surface, -ACTIONS_WIDTH);
          row.classList.add('swiped-full');
          openRow = row;
        } else {
          closeRow(row);
        }
      }

      surface.addEventListener('touchstart', onPointerDown, { passive: true });
      surface.addEventListener('touchmove', onPointerMove, { passive: false });
      surface.addEventListener('touchend', onPointerUp, { passive: true });
      surface.addEventListener('touchcancel', onPointerUp, { passive: true });

      surface.addEventListener('mousedown', function (e) {
        onPointerDown(e);
        function moveHandler(ev) { onPointerMove(ev); }
        function upHandler(ev) {
          onPointerUp(ev);
          document.removeEventListener('mousemove', moveHandler);
          document.removeEventListener('mouseup', upHandler);
        }
        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', upHandler);
      });

      // 已展开状态下，点击卡片本身＝收回（不进入聊天详情，因为详情页尚未设计）
      surface.addEventListener('click', function (e) {
        if (row.classList.contains('swiped-full')) {
          e.preventDefault();
          e.stopPropagation();
          closeRow(row);
        }
      });

      row.querySelector('.msg-action-pin').addEventListener('click', function () {
        var willPin = row.dataset.pinned !== 'true';
        movePin(row, willPin);
        closeRow(row, false);
      });
      row.querySelector('.msg-action-delete').addEventListener('click', function () {
        closeRow(row, false);
        deleteRow(row);
      });
    }

    Array.prototype.slice.call(document.querySelectorAll('.msg-row')).forEach(wireRow);

    // 点击列表以外的空白区域，收回已展开的会话
    document.addEventListener('click', function (e) {
      if (!openRow) return;
      if (e.target.closest && e.target.closest('.msg-row') === openRow) return;
      closeOpenRow();
    });

    refreshListState();

    // 暴露给下方"消息列表数据渲染"模块：新插入的行需要补挂手势绑定，
    // 且每次重新渲染后都要刷新计数/空态
    return { wireRow: wireRow, refreshListState: refreshListState, pinnedList: pinnedList, mainList: mainList };
  })();

  /* ==========================================================================
     筛选标签 —— 全部 / 未读 / 已读 / 群聊
     纯前端筛选：根据 .msg-row 内是否含未读角标 / "正在输入" / 群聊类头像
     判定分类，切换时对不匹配的行做淡出隐藏（不移除 DOM，避免打乱置顶结构）。
  ========================================================================== */
  var FilterTabsController = (function initFilterTabs() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.filter-chip'));
    if (!tabs.length) return null;

    function rowMatches(row, filter) {
      if (filter === 'all') return true;
      var hasUnread = !!row.querySelector('.msg-unread-badge, .msg-preview-typing');
      var isGroup = !!row.querySelector('.msg-avatar-group');
      if (filter === 'unread') return hasUnread;
      if (filter === 'read') return !hasUnread;
      if (filter === 'group') return isGroup;
      return true;
    }

    function currentFilter() {
      var active = tabs.filter(function (t) { return t.classList.contains('filter-chip-active'); })[0];
      return active ? active.dataset.filter : 'all';
    }

    // 依据当前选中的筛选项，对（可能是新渲染出的）行重新应用显隐——
    // 消息数据每次刷新后调用一次，保证切换到"未读"筛选时新行也能生效
    function applyCurrentFilter() {
      var filter = currentFilter();
      var allRows = Array.prototype.slice.call(document.querySelectorAll('#msgList .msg-row, #msgListMain .msg-row'));
      allRows.forEach(function (row) {
        row.style.display = rowMatches(row, filter) ? '' : 'none';
      });
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('filter-chip-active'); });
        tab.classList.add('filter-chip-active');
        applyCurrentFilter();
      });
    });

    return { applyCurrentFilter: applyCurrentFilter };
  })();

  /* ==========================================================================
     照片堆叠 —— 左右滑动切换堆叠顺序（循环），点击顶层卡片弹出上传弹窗
  ========================================================================== */
  (function initPhotoStack() {
    var stack = document.getElementById('photoStack');
    var hint = document.getElementById('stackHint');
    if (!stack) return;

    var cards = Array.prototype.slice.call(stack.querySelectorAll('.stack-card'));
    var order = [0, 1, 2]; // order[i] = depth 目前排在第 i 张的 slot 索引
    var hintDots = hint ? Array.prototype.slice.call(hint.querySelectorAll('.stack-hint-dot')) : [];

    function render() {
      cards.forEach(function (card) {
        var slot = parseInt(card.dataset.slot, 10);
        var depth = order.indexOf(slot);
        card.dataset.depth = depth;
      });
      hintDots.forEach(function (dot, i) {
        dot.classList.toggle('active', i === order[0]);
      });
    }

    function cycle(dir) {
      if (dir > 0) {
        order.push(order.shift());
      } else {
        order.unshift(order.pop());
      }
      render();
    }

    // 拖拽切换：作用于整个堆叠容器（顶层卡片跟手，松开根据位移判定切换方向）
    var startX = 0, dragging = false, dragged = false;

    function onDown(e) {
      var point = e.touches ? e.touches[0] : e;
      startX = point.clientX;
      dragging = true;
      dragged = false;
    }
    function onMove(e) {
      if (!dragging) return;
      var point = e.touches ? e.touches[0] : e;
      var dx = point.clientX - startX;
      if (Math.abs(dx) > 6) dragged = true;
    }
    function onUp(e) {
      if (!dragging) return;
      dragging = false;
      var point = (e.changedTouches && e.changedTouches[0]) || e;
      var dx = point.clientX - startX;
      if (Math.abs(dx) > 28) {
        cycle(dx < 0 ? 1 : -1);
      }
    }

    stack.addEventListener('touchstart', onDown, { passive: true });
    stack.addEventListener('touchmove', onMove, { passive: true });
    stack.addEventListener('touchend', onUp, { passive: true });
    stack.addEventListener('mousedown', function (e) {
      onDown(e);
      function mv(ev) { onMove(ev); }
      function up(ev) {
        onUp(ev);
        document.removeEventListener('mousemove', mv);
        document.removeEventListener('mouseup', up);
      }
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });

    // 点击顶层卡片（未被判定为拖拽）时打开上传弹窗
    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        if (dragged) { dragged = false; return; }
        if (card.dataset.depth === '0') {
          openUploadModal();
        } else {
          // 点击非顶层卡片：直接将其切到最前
          var slot = parseInt(card.dataset.slot, 10);
          var idx = order.indexOf(slot);
          order.splice(idx, 1);
          order.unshift(slot);
          render();
        }
      });
    });

    render();

    /* ---- 上传弹窗 ---- */
    var modal = document.getElementById('uploadModal');
    var scrim = document.getElementById('uploadScrim');
    var closeBtn = document.getElementById('uploadClose');
    var grid = document.getElementById('uploadGrid');
    var fileInput = document.getElementById('uploadFileInput');
    var activeSlotBtn = null;

    function openUploadModal() {
      if (!modal) return;
      modal.classList.add('open');
    }
    function closeUploadModal() {
      if (!modal) return;
      modal.classList.remove('open');
    }
    if (scrim) scrim.addEventListener('click', closeUploadModal);
    if (closeBtn) closeBtn.addEventListener('click', closeUploadModal);

    function applySlotImage(slotIndex, dataUrl, slotBtn) {
      var targetSlotBtn = slotBtn || (grid && grid.querySelector('.upload-slot[data-slot="' + slotIndex + '"]'));
      if (targetSlotBtn) {
        targetSlotBtn.classList.add('filled');
        targetSlotBtn.style.backgroundImage = 'url(' + dataUrl + ')';
        targetSlotBtn.style.backgroundSize = 'cover';
        targetSlotBtn.style.backgroundPosition = 'center';
      }
      var targetCard = cards.filter(function (c) { return c.dataset.slot === String(slotIndex); })[0];
      if (targetCard) {
        var fill = targetCard.querySelector('.stack-card-fill');
        if (fill) {
          fill.style.backgroundImage = 'url(' + dataUrl + ')';
          fill.style.backgroundSize = 'cover';
          fill.style.backgroundPosition = 'center';
        }
      }
    }

    // 启动时从数据库恢复三张已保存的照片
    if (window.LunaDB) {
      LunaDB.get('photoStack').then(function (saved) {
        if (saved && typeof saved === 'object') {
          Object.keys(saved).forEach(function (slotIndex) {
            if (saved[slotIndex]) applySlotImage(slotIndex, saved[slotIndex]);
          });
        }
      });
    }

    if (grid && fileInput) {
      Array.prototype.slice.call(grid.querySelectorAll('.upload-slot')).forEach(function (slotBtn) {
        slotBtn.addEventListener('click', function () {
          activeSlotBtn = slotBtn;
          fileInput.click();
        });
      });

      fileInput.addEventListener('change', function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file || !activeSlotBtn) return;
        var reader = new FileReader();
        reader.onload = function (e) {
          var slotIndex = activeSlotBtn.dataset.slot;
          var dataUrl = e.target.result;
          applySlotImage(slotIndex, dataUrl, activeSlotBtn);

          // 持久化保存到 IndexedDB，刷新后不丢失
          if (window.LunaDB) {
            LunaDB.get('photoStack').then(function (saved) {
              saved = saved && typeof saved === 'object' ? saved : {};
              saved[slotIndex] = dataUrl;
              LunaDB.set('photoStack', saved);
            });
          }
        };
        reader.readAsDataURL(file);
        fileInput.value = '';
      });
    }

    /* ---- 顶栏：头像 + 昵称，点击打开编辑弹窗 ---- */
    var identityBtn = document.getElementById('topIdentityBtn');
    var identityName = document.getElementById('topIdentityName');
    var identityAvatar = document.getElementById('topIdentityAvatar');
    var identityModal = document.getElementById('identityModal');
    var identityScrim = document.getElementById('identityScrim');
    var identityAvatarBtn = document.getElementById('identityAvatarBtn');
    var identityModalAvatar = document.getElementById('identityModalAvatar');
    var identityNameInput = document.getElementById('identityNameInput');
    var identitySaveBtn = document.getElementById('identitySave');
    var identityFileInput = document.getElementById('topIdentityFileInput');
    var pendingAvatarDataUrl = null;

    /* ---- 我的页 · 资料页：头像/昵称与顶栏保持同步，新增独立头像/封面/签名入口 ---- */
    var profileCardName = document.getElementById('profileCardName');
    var profileCardAvatar = document.getElementById('profileCardAvatar');
    var profileAvatarFileInput = document.getElementById('profileAvatarFileInput');

    function syncProfileCard(name, avatarUrl) {
      if (name && profileCardName) profileCardName.textContent = name;
      if (avatarUrl && profileCardAvatar) {
        profileCardAvatar.innerHTML =
          '<img src="' + avatarUrl + '" alt="" />' +
          '<span class="ica-plate" aria-hidden="true"></span>' +
          '<span class="ica-halo" aria-hidden="true"></span>' +
          '<span class="ica-ticks" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>' +
          '<span class="pf-avatar-plus" aria-hidden="true"><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></span>';
        profileCardAvatar.classList.add('has-photo');
      }
    }

    // 资料页头像可独立点击上传，同时回写顶栏与身份弹窗的待存头像，
    // 保证「我」在全站任何位置看到的都是同一张脸
    function applyAvatarEverywhere(dataUrl) {
      pendingAvatarDataUrl = dataUrl;
      syncProfileCard(null, dataUrl);
      if (identityAvatar) {
        identityAvatar.innerHTML = '<img src="' + dataUrl + '" alt="" /><span class="top-identity-avatar-plus" aria-hidden="true"><svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></span>';
        identityAvatar.classList.add('has-photo');
      }
      if (identityModalAvatar) {
        identityModalAvatar.innerHTML = '<img src="' + dataUrl + '" alt="" />';
      }
      if (window.LunaDB) {
        LunaDB.get('identity').then(function (saved) {
          var name = (saved && saved.name) || (identityName ? identityName.textContent : '');
          LunaDB.set('identity', { name: name, avatar: dataUrl });
        });
      }
    }
    if (profileCardAvatar && profileAvatarFileInput) {
      profileCardAvatar.addEventListener('click', function () { profileAvatarFileInput.click(); });
      profileAvatarFileInput.addEventListener('change', function () {
        var file = profileAvatarFileInput.files && profileAvatarFileInput.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (e) { applyAvatarEverywhere(e.target.result); };
        reader.readAsDataURL(file);
        profileAvatarFileInput.value = '';
      });
    }

    function openIdentityModal() {
      if (!identityModal) return;
      if (identityNameInput) identityNameInput.value = identityName ? identityName.textContent : '';
      identityModal.classList.add('open');
    }
    function closeIdentityModal() {
      if (!identityModal) return;
      identityModal.classList.remove('open');
    }
    if (identityBtn) identityBtn.addEventListener('click', openIdentityModal);
    if (identityScrim) identityScrim.addEventListener('click', closeIdentityModal);
    var profileIdBtn = document.getElementById('profileIdCard');
    if (profileIdBtn) profileIdBtn.addEventListener('click', openIdentityModal);

    if (identityAvatarBtn && identityFileInput) {
      identityAvatarBtn.addEventListener('click', function () {
        identityFileInput.click();
      });
      identityFileInput.addEventListener('change', function () {
        var file = identityFileInput.files && identityFileInput.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (e) {
          pendingAvatarDataUrl = e.target.result;
          if (identityModalAvatar) {
            identityModalAvatar.innerHTML = '<img src="' + pendingAvatarDataUrl + '" alt="" />';
          }
        };
        reader.readAsDataURL(file);
        identityFileInput.value = '';
      });
    }

    if (identitySaveBtn) {
      identitySaveBtn.addEventListener('click', function () {
        var newName = (identityNameInput && identityNameInput.value || '').trim();
        if (newName && identityName) {
          identityName.textContent = newName;
        }
        if (pendingAvatarDataUrl && identityAvatar) {
          identityAvatar.innerHTML = '<img src="' + pendingAvatarDataUrl + '" alt="" /><span class="top-identity-avatar-plus" aria-hidden="true"><svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></span>';
          identityAvatar.classList.add('has-photo');
        }
        // 持久化保存昵称与头像
        var finalName = newName && identityName ? identityName.textContent : (identityName ? identityName.textContent : '');
        if (window.LunaDB) {
          LunaDB.set('identity', {
            name: finalName,
            avatar: pendingAvatarDataUrl || null
          });
        }
        syncProfileCard(finalName, pendingAvatarDataUrl);
        closeIdentityModal();
      });
    }

    // 启动时从数据库恢复昵称与头像
    if (window.LunaDB) {
      LunaDB.get('identity').then(function (saved) {
        if (!saved) return;
        if (saved.name && identityName) identityName.textContent = saved.name;
        if (saved.avatar && identityAvatar) {
          identityAvatar.innerHTML = '<img src="' + saved.avatar + '" alt="" /><span class="top-identity-avatar-plus" aria-hidden="true"><svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></span>';
          identityAvatar.classList.add('has-photo');
          pendingAvatarDataUrl = saved.avatar;
        }
        syncProfileCard(saved.name, saved.avatar);
      });
    }

    /* ---- 我的页 · 封面：支持图片或视频，持久化保存 ---- */
    var profileCoverBtn = document.getElementById('profileCoverBtn');
    var profileCoverMedia = document.getElementById('profileCoverMedia');
    var profileCoverFileInput = document.getElementById('profileCoverFileInput');

    function applyProfileCover(dataUrl, mimeType) {
      if (!profileCoverMedia || !profileCoverBtn) return;
      var old = profileCoverMedia.querySelector('img, video');
      if (old) old.remove();
      var isVideo = mimeType && mimeType.indexOf('video') === 0;
      var el = document.createElement(isVideo ? 'video' : 'img');
      if (isVideo) {
        el.autoplay = true; el.loop = true; el.muted = true; el.playsInline = true;
      } else {
        el.alt = '';
      }
      el.src = dataUrl;
      profileCoverMedia.appendChild(el);
      profileCoverBtn.classList.add('has-media');
    }
    if (window.LunaDB) {
      LunaDB.get('profileCover').then(function (saved) {
        if (saved && saved.data) applyProfileCover(saved.data, saved.type);
      });
    }
    if (profileCoverBtn && profileCoverFileInput) {
      profileCoverBtn.addEventListener('click', function () { profileCoverFileInput.click(); });
      profileCoverFileInput.addEventListener('change', function () {
        var file = profileCoverFileInput.files && profileCoverFileInput.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (e) {
          var dataUrl = e.target.result;
          applyProfileCover(dataUrl, file.type);
          if (window.LunaDB) LunaDB.set('profileCover', { data: dataUrl, type: file.type });
        };
        reader.readAsDataURL(file);
        profileCoverFileInput.value = '';
      });
    }

    /* ---- 我的页 · 个性签名：点击弹出编辑面板，持久化保存 ---- */
    var profileBioBtn = document.getElementById('profileBioBtn');
    var profileBioText = document.getElementById('profileBioText');
    var bioModal = document.getElementById('bioModal');
    var bioModalScrim = document.getElementById('bioModalScrim');
    var bioModalTextarea = document.getElementById('bioModalTextarea');
    var bioModalSave = document.getElementById('bioModalSave');
    var DEFAULT_BIO = '点一下，写句想被记住的话';

    function openBioModal() {
      if (!bioModal) return;
      var current = profileBioText ? profileBioText.textContent : '';
      bioModalTextarea.value = current === DEFAULT_BIO ? '' : current;
      bioModal.classList.add('open');
    }
    function closeBioModal() {
      if (!bioModal) return;
      bioModal.classList.remove('open');
    }
    if (profileBioBtn) profileBioBtn.addEventListener('click', openBioModal);
    if (bioModalScrim) bioModalScrim.addEventListener('click', closeBioModal);
    if (bioModalSave) {
      bioModalSave.addEventListener('click', function () {
        var text = (bioModalTextarea.value || '').trim();
        var finalText = text || DEFAULT_BIO;
        if (profileBioText) profileBioText.textContent = finalText;
        if (window.LunaDB) LunaDB.set('profileBio', text);
        closeBioModal();
      });
    }
    if (window.LunaDB) {
      LunaDB.get('profileBio').then(function (saved) {
        if (saved && profileBioText) profileBioText.textContent = saved;
      });
    }
  })();

  /* ============================================================
     好友页票根装饰组件：点击左联换照片，右联昵称/寄语可直接点按编辑
     照片/昵称/寄语均持久化存入 IndexedDB，刷新页面后自动恢复
  ============================================================ */
  (function () {
    var photoBtn = document.getElementById('ticketPhotoBtn');
    var photoFrame = document.getElementById('ticketPhotoFrame');
    var fileInput = document.getElementById('ticketFileInput');
    var nameEl = document.getElementById('ticketName');
    var quoteEl = document.getElementById('ticketQuote');

    function setPhoto(dataUrl) {
      var placeholder = photoFrame.querySelector('.ec-photo-placeholder');
      if (placeholder) placeholder.remove();
      var img = photoFrame.querySelector('img');
      if (!img) {
        img = document.createElement('img');
        img.alt = '';
        photoFrame.appendChild(img);
      }
      img.src = dataUrl;
      photoFrame.classList.add('has-photo');
    }

    if (photoBtn && fileInput && photoFrame) {
      photoBtn.addEventListener('click', function () {
        fileInput.click();
      });
      fileInput.addEventListener('change', function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (e) {
          setPhoto(e.target.result);
          if (window.LunaDB) {
            LunaDB.get('emblem').then(function (saved) {
              saved = saved && typeof saved === 'object' ? saved : {};
              saved.photo = e.target.result;
              LunaDB.set('emblem', saved);
            });
          }
        };
        reader.readAsDataURL(file);
        fileInput.value = '';
      });
    }

    // 昵称与寄语：contenteditable 直接点按编辑，失焦时兜底空值，回车确认失焦
    [nameEl, quoteEl].forEach(function (el) {
      if (!el) return;
      var fallback = el.textContent;
      var dbKey = el === nameEl ? 'name' : 'quote';
      el.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          el.blur();
        }
      });
      el.addEventListener('blur', function () {
        var text = el.textContent.trim();
        el.textContent = text.length ? text : fallback;
        if (window.LunaDB) {
          LunaDB.get('emblem').then(function (saved) {
            saved = saved && typeof saved === 'object' ? saved : {};
            saved[dbKey] = el.textContent;
            LunaDB.set('emblem', saved);
          });
        }
      });
    });

    // 启动时从数据库恢复照片/昵称/寄语
    if (window.LunaDB) {
      LunaDB.get('emblem').then(function (saved) {
        if (!saved) return;
        if (saved.photo && photoFrame) setPhoto(saved.photo);
        if (saved.name && nameEl) nameEl.textContent = saved.name;
        if (saved.quote && quoteEl) quoteEl.textContent = saved.quote;
      });
    }

    // 与顶栏昵称联动：若用户已在顶栏设置过昵称，票根初始即同步显示
    var topIdentityName = document.getElementById('topIdentityName');
    if (topIdentityName && nameEl && topIdentityName.textContent.trim() && topIdentityName.textContent.trim() !== '用户昵称') {
      if (!nameEl.textContent.trim() || nameEl.textContent.trim() === '用户昵称') {
        nameEl.textContent = topIdentityName.textContent.trim();
      }
    }
  })();

  /* ============================================================
     消息页语录卡：昵称/头像与顶栏联动，语录文字可直接点按编辑，
     并持久化存入 IndexedDB，刷新页面后自动恢复
  ============================================================ */
  (function () {
    var quoteAvatar = document.getElementById('quoteAvatar');
    var quoteName = document.getElementById('quoteName');
    var quoteText = document.getElementById('quoteText');

    if (quoteText) {
      var fallback = quoteText.textContent;
      quoteText.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          quoteText.blur();
        }
      });
      quoteText.addEventListener('blur', function () {
        var text = quoteText.textContent.trim();
        quoteText.textContent = text.length ? text : fallback;
        if (window.LunaDB) LunaDB.set('quoteText', quoteText.textContent);
      });
    }

    if (window.LunaDB) {
      LunaDB.get('quoteText').then(function (saved) {
        if (saved && quoteText) quoteText.textContent = saved;
      });
      LunaDB.get('identity').then(function (saved) {
        if (!saved) return;
        if (saved.name && quoteName) quoteName.textContent = saved.name;
        if (saved.avatar && quoteAvatar) {
          quoteAvatar.innerHTML = '<img src="' + saved.avatar + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" />';
        }
      });
    }
  })();



  /* ============================================================
     好友清单区：真实好友数据 → 渲染卡片列表 → 统计数字与列表联动
     数据初始为空数组（呈现空态），不再写死任何示例好友，
     计数始终从实际渲染的条目数取得。分组结构以 IndexedDB 中的
     数据为准，若数据库中尚无记录，则展示"星标挚友/我的好友"两个
     空分组框架，等待真实数据接入。
  ============================================================ */
  (function () {
    // 分组数据结构：每组含中英双行组名 + 该组好友数组，初始均为空。
    var GROUPS = [
      { id: 'starred', cn: '星标挚友', en: 'STARRED', collapsed: false, friends: [] },
      { id: 'default', cn: '我的好友', en: 'ALL FRIENDS', collapsed: false, friends: [] }
    ];

    // 注意：listEl/countEl/sectionEl 只存在于"好友页"自身的 DOM 里。
    // 但本 IIFE 除了渲染好友页列表之外，还承担着导出 window.LunaFriends
    // （好友数据的读写接口）、从 IndexedDB 恢复 friendGroups 等"全站
    // 共享"的职责——聊天室页（chatroom.html）、消息页等其它页面虽然
    // 没有这三个 DOM 节点，但同样需要 window.LunaFriends 可用（例如
    // 转发功能要读 uniqueFriends()）。因此这里绝不能在缺少这三个节点
    // 时整体 return，否则会导致 window.LunaFriends 在那些页面上根本
    // 不存在。改为只在真正需要写 DOM 的地方（renderFriends 内部）判空。
    var listEl = document.getElementById('friendsList');
    var countEl = document.getElementById('friendsTotalCount');
    var sectionEl = document.getElementById('flistSection');

    // 罗马数字序号，呼应全站"錾刻/卷宗"字体语言，避免使用阿拉伯数字或 emoji
    var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

    function totalFriends() {
      var n = 0;
      GROUPS.forEach(function (g) { n += g.friends.length; });
      return n;
    }

    /* ---- 好友环头像色阶：黑白灰循环取色，与好友卡片头像语言呼应 ---- */
    var TONE_CYCLE = ['a', 'b', 'c', 'd', 'e', 'f'];
    function toneForKey(key) {
      var n = String(key || '').split('').reduce(function (a, c) { return a + c.charCodeAt(0); }, 0);
      return TONE_CYCLE[n % TONE_CYCLE.length];
    }

    /* ---- 全部好友去重：同一好友可能同时出现在"全部好友"聚合分组
       与"星标挚友/我的好友"等分组里，去重以 charId（无则退化为
       姓名）为准，避免消息页好友环出现重复头像 ---- */
    function uniqueFriends() {
      var seen = {};
      var list = [];
      GROUPS.forEach(function (g) {
        g.friends.forEach(function (f) {
          var key = f.charId != null ? ('c:' + f.charId) : ('n:' + f.name);
          if (seen[key]) return;
          seen[key] = true;
          list.push(f);
        });
      });
      return list;
    }

    function buildItem(f, i) {
      var item = document.createElement('div');
      item.className = 'flist-item';
      item.setAttribute('data-online', f.online ? 'true' : 'false');
      // 暴露 charId：好友资料展示页（friend-profile.js）需要据此去
      // LunaCharDB 里读取该好友关联角色的档案背景图（cardBg），
      // 光凭好友列表自身的字段（name/avatar/note）拿不到这份数据
      if (f.charId != null) item.setAttribute('data-char-id', String(f.charId));
      item.style.animationDelay = (i * 0.05) + 's';

      var initial = (f.name || '').charAt(0);

      var avatarInner = f.avatar
        ? '<img src="' + f.avatar + '" alt="" />'
        : '<span class="flist-avatar-glyph">' + initial + '</span>';

      item.innerHTML =
        '<div class="flist-avatar">' +
          avatarInner +
          '<span class="flist-status-dot" aria-hidden="true"></span>' +
        '</div>' +
        '<div class="flist-body">' +
          '<div class="flist-name-row">' +
            '<span class="flist-name">' + f.name + '</span>' +
            (f.badge ? '<span class="flist-badge">' + f.badge + '</span>' : '') +
          '</div>' +
          '<div class="flist-sub">' +
            '<span class="flist-sub-status"></span>' +
            (f.note ? '<span class="flist-sub-dot" aria-hidden="true"></span><span class="flist-sub-text">' + f.note + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<span class="flist-item-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 5L16 12L9 19" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';

      return item;
    }

    function buildGroup(g, gi) {
      var wrap = document.createElement('div');
      wrap.className = 'fgroup';
      wrap.setAttribute('data-collapsed', g.collapsed ? 'true' : 'false');
      wrap.setAttribute('data-group', g.id);

      var onlineCount = g.friends.filter(function (f) { return f.online; }).length;

      var head = document.createElement('button');
      head.type = 'button';
      head.className = 'fgroup-head';
      head.setAttribute('aria-expanded', g.collapsed ? 'false' : 'true');
      var roman = ROMAN[gi] || String(gi + 1);
      head.innerHTML =
        '<span class="fgroup-numeral" data-num="' + roman + '"><span class="fgroup-numeral-glyph">' + roman + '</span></span>' +
        '<span class="fgroup-title-col">' +
          '<span class="fgroup-cn">' + g.cn + '</span>' +
          '<span class="fgroup-en">' + g.en + '</span>' +
        '</span>' +
        '<span class="fgroup-meta">' +
          '<span class="fgroup-online"><span class="fgroup-online-num">' + onlineCount + '</span>在线</span>' +
          '<span class="fgroup-num">' + g.friends.length + '</span>' +
        '</span>' +
        '<svg class="fgroup-chevron" width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

      var body = document.createElement('div');
      body.className = 'fgroup-body';
      var inner = document.createElement('div');
      inner.className = 'fgroup-body-inner';
      g.friends.forEach(function (f, i) { inner.appendChild(buildItem(f, i)); });
      body.appendChild(inner);

      head.addEventListener('click', function () {
        g.collapsed = !g.collapsed;
        wrap.setAttribute('data-collapsed', g.collapsed ? 'true' : 'false');
        head.setAttribute('aria-expanded', g.collapsed ? 'false' : 'true');
        if (g.collapsed) {
          body.style.height = body.scrollHeight + 'px';
          requestAnimationFrame(function () { body.style.height = '0px'; });
        } else {
          body.style.height = body.scrollHeight + 'px';
          body.addEventListener('transitionend', function te() {
            body.style.height = '';
            body.removeEventListener('transitionend', te);
          });
        }
      });

      wrap.appendChild(head);
      wrap.appendChild(body);
      return wrap;
    }

    function renderFriends() {
      // 当前页面没有好友页自身的列表 DOM（例如聊天室页/消息页）时，
      // 跳过这部分 DOM 渲染，但函数仍需继续往下执行——调用方（save()、
      // 数据库读取回调等）依赖 renderFriends() 之后紧跟的
      // renderMessagesStoryRing() 与事件广播照常发生。
      if (listEl && countEl && sectionEl) {
        listEl.innerHTML = '';

        GROUPS.forEach(function (g, gi) {
          if (g.friends.length === 0) return;
          listEl.appendChild(buildGroup(g, gi));
        });

        // 计数与空态均由实际渲染出的条目数决定，杜绝"列表为空却显示数字"
        // 或"有数据却显示 0"的不一致情况。
        var total = totalFriends();
        countEl.textContent = String(total);
        sectionEl.setAttribute('data-empty', total === 0 ? 'true' : 'false');
      }

      renderMessagesStoryRing();
    }

    /* ==========================================================================
       消息页 · "好友动态"精选环：与好友页数据同源（LunaFriends.groups），
       不再依赖已删除的会话系统。仅展示"在线"好友（在线状态同样来自
       好友数据本身，不写死"暂无在线"）；无在线好友时回落到空态占位，
       与好友页空态语言保持一致。
    ========================================================================== */
    function buildStoryRingItem(f) {
      var item = document.createElement('div');
      item.className = 'story-item';
      item.dataset.tone = toneForKey(f.charId != null ? f.charId : f.name);

      var letter = (f.name || '?').charAt(0);

      var halo = document.createElement('div');
      halo.className = 'story-ring-halo';
      var avatarBox = document.createElement('div');
      avatarBox.className = 'story-avatar';

      if (f.avatar) {
        var img = document.createElement('img');
        img.src = f.avatar;
        img.alt = '';
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
        // 头像图片损坏/加载失败时，浏览器会在图内渲染一串很丑的
        // 占位小点/裂图标记，且会被圆形裁切层压出奇怪的层级观感。
        // 这里兜底：一旦 onerror 触发，直接把 <img> 换成干净的字母头像，
        // 不让任何浏览器默认的破图占位符有机会显示出来。
        img.onerror = function () {
          avatarBox.innerHTML = '<i>' + letter + '</i>';
        };
        avatarBox.appendChild(img);
      } else {
        avatarBox.innerHTML = '<i>' + letter + '</i>';
      }

      var pulse = document.createElement('span');
      pulse.className = 'story-pulse';
      halo.appendChild(avatarBox);
      halo.appendChild(pulse);

      var nameEl = document.createElement('span');
      nameEl.className = 'story-name';
      nameEl.textContent = f.name || '';

      item.appendChild(halo);
      item.appendChild(nameEl);

      return item;
    }

    function renderMessagesStoryRing() {
      var ring = document.getElementById('storyRing');
      var numEl = document.querySelector('.srl-num');
      var countEl2 = document.querySelector('.srl-count');
      if (!ring) return;

      var online = uniqueFriends().filter(function (f) { return !!f.online; });
      var onlineCount = online.length;

      if (numEl) numEl.textContent = onlineCount < 10 ? '0' + onlineCount : String(onlineCount);
      if (countEl2) countEl2.textContent = onlineCount > 0 ? (onlineCount + ' 位在线') : '暂无在线';

      if (onlineCount === 0) {
        ring.classList.add('story-ring-empty');
        ring.innerHTML =
          '<div class="story-empty">' +
            '<span class="story-empty-ring"><span class="story-empty-dot"></span></span>' +
            '<span class="story-empty-text">还没有好友动态</span>' +
          '</div>';
        return;
      }

      ring.classList.remove('story-ring-empty');
      ring.innerHTML = '';
      online.forEach(function (f) { ring.appendChild(buildStoryRingItem(f)); });
    }

    // 是否已完成启动时的一次性数据库读取。在此之前绝不允许 save()
    // 把内存里的初始空 GROUPS 写回数据库——否则任何在读库完成前
    // 触发的 save()（例如切换 tab 时连带调用到的渲染/保存路径）
    // 都会用空数组覆盖掉数据库里已经保存的真实好友数据，造成
    // "切一次 tab 数据就整个消失"的严重 bug。
    var friendsLoaded = false;

    // 暴露读写接口，供后续"加好友/分组管理"等功能写入真实数据后
    // 调用 window.LunaFriends.save() 持久化并重新渲染。先导出、
    // 再异步读库——确保下面 LunaDB.get('friendGroups') 的回调触发时，
    // window.LunaFriends 一定已经存在，可以安全地覆盖 .groups 引用。
    window.LunaFriends = {
      groups: GROUPS,
      save: function () {
        // 数据库初次读取尚未完成时，直接跳过持久化写入（但仍然
        // 允许内存态渲染），避免用尚未加载完成的空/旧 GROUPS
        // 覆盖数据库里已经存在的数据。读取完成后如仍有待保存的
        // 修改，调用方会在数据到手后重新触发一次 save()。
        if (!friendsLoaded) {
          renderFriends();
          return;
        }
        if (window.LunaDB) LunaDB.set('friendGroups', GROUPS);
        renderFriends();
        // 广播好友数据变更，动态页故事环等其它模块借此实时刷新，
        // 不必与好友模块产生直接的函数引用耦合
        document.dispatchEvent(new CustomEvent('luna:friends-changed'));
      },
      // 供消息列表模块复用：按 charId/姓名去重后的好友数组、以及与
      // 好友卡片一致的头像取色算法，避免消息页头像与好友页对不上
      uniqueFriends: uniqueFriends,
      toneForKey: toneForKey,
      // 供其它页面（如聊天室转发功能）判断"数据库首次读取是否已经
      // 完成"——不能仅凭 uniqueFriends() 返回空数组就断定用户确实
      // 没有好友，因为读库是异步的，可能只是还没读完
      isLoaded: function () { return friendsLoaded; }
    };

    // 启动时从数据库恢复好友分组数据；若数据库中尚无记录（首次使用），
    // 则保持初始的空分组框架，不显示任何写死的示例好友。
    if (window.LunaDB) {
      LunaDB.get('friendGroups').then(function (saved) {
        if (saved && Array.isArray(saved) && saved.length) {
          GROUPS = saved;
          // GROUPS 被整体替换为新数组后，必须同步更新导出对象上的
          // 引用——否则 window.LunaFriends.groups 会停留在替换前的
          // 那个空数组上，其它模块（如动态页故事环）读到的永远是
          // 过期数据，即使好友页自己渲染正常也发现不了这个问题
          window.LunaFriends.groups = GROUPS;
        }
        // 必须先标记"已加载完成"，再渲染/广播——否则如果 renderFriends()
        // 或事件监听内部又同步触发了一次 save()，那次 save() 仍会因
        // friendsLoaded 还是 false 而被跳过，导致这一轮真实数据白白
        // 读了一遍却没能落盘。
        friendsLoaded = true;
        renderFriends();
        document.dispatchEvent(new CustomEvent('luna:friends-changed'));
      });
    } else {
      friendsLoaded = true;
      renderFriends();
    }
  })();

  /* ==========================================================================
     消息页 —— 会话列表数据渲染，与聊天室（chatroom.js）真实消息同步
     数据来源：LunaDB 中所有 'chatroom:*' 记录（每个好友一条会话，
     key 为 chatroom:char-{id} 或 chatroom:name-{name}，与 chatroom.js
     里 storeKey 的生成规则完全一致）。每条记录取最后一条消息作为预览、
     取 from!=='me' 的连续尾部条数作为未读数（简单起见：只要该会话最后
     一条是我方消息，则未读清零；否则未读数＝从尾部往前数对方连续
     消息条数），从而无需额外维护"已读/未读"独立状态。

     触发时机：
       - 首次进入消息页（luna:friends-changed 首次广播，即好友数据
         就绪后，因为渲染会话行需要好友的头像/昵称/在线状态）
       - 好友数据变更（luna:friends-changed）
       - 任意聊天室发送新消息后的广播（luna:messages-changed）
  ========================================================================== */
  (function initMessageList() {
    if (!MsgListController) return; // 页面没有消息列表容器（非聊天页）时跳过

    var SESSION_KEY = 'luna_chat_session'; // 需与 chatroom.js 保持一致

    function storeKeyFor(f) {
      return 'chatroom:' + (f.charId != null ? ('char-' + f.charId) : ('name-' + f.name));
    }

    function fmtTime(ts) {
      if (!ts) return '';
      var d = new Date(ts);
      var now = new Date();
      var sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
      if (sameDay) {
        return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
      }
      var oneDay = 24 * 60 * 60 * 1000;
      var isYesterday = now - d < oneDay * 2 && now.getDate() - d.getDate() === 1;
      if (isYesterday) return '昨天';
      return (d.getMonth() + 1) + '/' + d.getDate();
    }

    // 未读数：从消息列表尾部往前数，连续属于对方（from !== 'me'）的
    // 条数；一旦遇到我方消息或列表见底就停止。最后一条若是我方发出，
    // 未读自然为 0（已回复＝已读）
    function countUnread(list) {
      var n = 0;
      for (var i = list.length - 1; i >= 0; i--) {
        if (list[i].from === 'me') break;
        n++;
      }
      return n;
    }

    function previewText(msg) {
      if (!msg) return '';
      if (msg.text != null) return msg.text;
      if (msg.type === 'image') return '[图片]';
      return '';
    }

    function buildRow(f, data) {
      var row = document.createElement('div');
      row.className = 'msg-row';
      row.dataset.pinned = f.pinnedInMsgList ? 'true' : 'false';
      if (f.charId != null) row.setAttribute('data-char-id', String(f.charId));
      row.setAttribute('data-friend-name', f.name || '');

      var list = data.list || [];
      var last = list.length ? list[list.length - 1] : null;
      var unread = countUnread(list);
      var tone = window.LunaFriends && window.LunaFriends.toneForKey ? window.LunaFriends.toneForKey(f.charId != null ? f.charId : f.name) : 'a';
      var initial = (f.name || '?').charAt(0);

      var avatarInner = f.avatar
        ? '<img src="' + f.avatar + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />'
        : '<span class="msg-ink" data-tone="' + tone + '">' + initial + '</span>';

      row.innerHTML =
        '<div class="msg-actions">' +
          '<button type="button" class="msg-action msg-action-pin"><span>' + (row.dataset.pinned === 'true' ? '取消置顶' : '置顶') + '</span></button>' +
          '<button type="button" class="msg-action msg-action-delete"><span>删除</span></button>' +
        '</div>' +
        '<div class="msg-surface">' +
          '<span class="msg-pin-flag" aria-hidden="true"></span>' +
          '<div class="msg-avatar">' +
            '<div class="msg-avatar-clip">' + avatarInner + '</div>' +
            (f.online ? '<span class="msg-online" aria-hidden="true"></span>' : '') +
          '</div>' +
          '<div class="msg-body">' +
            '<div class="msg-top">' +
              '<span class="msg-name">' + (f.name || '好友') + '</span>' +
              '<span class="msg-time">' + (last ? fmtTime(last.ts) : '') + '</span>' +
            '</div>' +
            '<div class="msg-bottom">' +
              '<span class="msg-preview">' + (last ? previewText(last) : '暂无消息，去打个招呼吧') + '</span>' +
              (unread > 0 ? '<span class="msg-unread-badge">' + (unread > 99 ? '99+' : unread) + '</span>' : '') +
            '</div>' +
          '</div>' +
        '</div>';

      // 头像图片一旦加载失败（损坏的 dataURL / 过期的 blob URL 等），
      // 浏览器会在 <img> 框内画出很难看的裂图小点占位符，且会被头像的
      // 圆形裁切层压出诡异的层级观感。这里补一个 onerror 兜底：
      // 加载失败就把 <img> 换成干净的字母头像。
      var avatarImgEl = row.querySelector('.msg-avatar-clip img');
      if (avatarImgEl) {
        avatarImgEl.onerror = function () {
          var clip = row.querySelector('.msg-avatar-clip');
          if (!clip) return;
          clip.innerHTML = '<span class="msg-ink" data-tone="' + tone + '">' + initial + '</span>';
        };
      }

      // 点击卡片本身（非滑开状态、非动作按钮）＝进入该好友的聊天室：
      // 写入与 friend-profile.js 相同结构/相同 key 的会话令牌后跳转，
      // 保证 chatroom.js 的 readSession() 能正常读到
      row.querySelector('.msg-surface').addEventListener('click', function (e) {
        if (row.classList.contains('swiped-full')) return; // 交给滑开收回逻辑处理
        if (e.target.closest && e.target.closest('.msg-action')) return;
        try {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify({
            name: f.name || '好友',
            charId: f.charId != null ? f.charId : null,
            avatar: f.avatar || null,
            color: f.color || null,
            online: !!f.online
          }));
        } catch (err) {}
        window.location.href = 'chatroom.html';
      });

      return row;
    }

    function render() {
      if (!window.LunaDB || !window.LunaFriends || !window.LunaFriends.uniqueFriends) return;

      var friends = window.LunaFriends.uniqueFriends();
      if (!friends.length) {
        MsgListController.pinnedList.innerHTML = '';
        MsgListController.mainList.innerHTML = '';
        MsgListController.refreshListState();
        return;
      }

      LunaDB.getAll('chatroom:').then(function (records) {
        var byKey = {};
        records.forEach(function (r) { byKey[r.key] = r.value || []; });

        // 只展示"确有会话记录"的好友——尚未聊过天的好友不出现在消息页，
        // 与列表页顶部"全部消息"计数应只反映真实会话数的预期一致
        var withChat = friends.filter(function (f) { return byKey.hasOwnProperty(storeKeyFor(f)); });

        // 按最后一条消息时间倒序排列，最新的会话排在最上面
        withChat.sort(function (a, b) {
          var la = byKey[storeKeyFor(a)] || [];
          var lb = byKey[storeKeyFor(b)] || [];
          var ta = la.length ? la[la.length - 1].ts : 0;
          var tb = lb.length ? lb[lb.length - 1].ts : 0;
          return tb - ta;
        });

        MsgListController.pinnedList.innerHTML = '';
        MsgListController.mainList.innerHTML = '';

        withChat.forEach(function (f) {
          var list = byKey[storeKeyFor(f)] || [];
          var row = buildRow(f, { list: list });
          MsgListController.wireRow(row);
          var target = f.pinnedInMsgList ? MsgListController.pinnedList : MsgListController.mainList;
          target.appendChild(row);
        });

        MsgListController.refreshListState();
        if (FilterTabsController) FilterTabsController.applyCurrentFilter();
      });
    }

    document.addEventListener('luna:friends-changed', render);
    document.addEventListener('luna:messages-changed', render);
    // 首次渲染：好友模块会在 DB 读取完成后（无论有无历史数据）主动
    // 触发一次 luna:friends-changed，此处无需再单独调用一次 render()
    // 以避免好友数据尚未就绪时读到空数组
  })();

  /* ==========================================================================
     好友页 —— 寻访搜索面板展开/收起
     点击顶栏搜索石印按钮：展开/收起 .friend-search-panel，并给按钮加
     is-active 反馈态；面板展开时自动聚焦输入框。输入内容变化时切换
     清空按钮的显隐；点击清空按钮清空并重新聚焦。
     切换到好友以外的页面时自动收起，避免残留展开状态。
  ========================================================================== */
  (function initFriendSearch() {
    var searchBtn = document.getElementById('friendSearchBtn');
    var panel = document.getElementById('friendSearchPanel');
    var input = document.getElementById('friendSearchInput');
    var clearBtn = document.getElementById('friendSearchClear');
    if (!searchBtn || !panel || !input || !clearBtn) return;

    function openPanel() {
      panel.classList.add('is-open');
      searchBtn.classList.add('is-active');
      setTimeout(function () { input.focus(); }, 180);
    }
    function closePanel() {
      panel.classList.remove('is-open');
      searchBtn.classList.remove('is-active');
      input.blur();
    }
    function togglePanel() {
      if (panel.classList.contains('is-open')) closePanel();
      else openPanel();
    }

    searchBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      togglePanel();
    });

    input.addEventListener('input', function () {
      clearBtn.classList.toggle('is-visible', input.value.length > 0);
    });

    clearBtn.addEventListener('click', function () {
      input.value = '';
      clearBtn.classList.remove('is-visible');
      input.focus();
    });

    // 离开好友页时自动收起，避免切回时残留展开状态
    document.querySelectorAll('.tab-item').forEach(function (tab) {
      tab.addEventListener('click', function () {
        if (tab.getAttribute('data-tab') !== 'friends') closePanel();
      });
    });
  })();

  /* ==========================================================================
     添加弹窗 —— 点击顶栏"加好友"菱形徽章，展开华丽底部弹层
     四枚卡片（单聊/群聊/分组/加好友）目前均为占位交互，
     点击后有回弹反馈动效，后续接入真实创建流程时在此扩展。
  ========================================================================== */
  (function initAddModal() {
    var addBtn = document.getElementById('friendAddBtn');
    var modal = document.getElementById('addModal');
    var scrim = document.getElementById('addModalScrim');
    if (!addBtn || !modal || !scrim) return;

    function openModal() { modal.classList.add('open'); }
    function closeModal() { modal.classList.remove('open'); }

    addBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      openModal();
    });
    scrim.addEventListener('click', closeModal);

    Array.prototype.slice.call(modal.querySelectorAll('.add-tile')).forEach(function (tile) {
      tile.addEventListener('click', function () {
        // 占位交互：当前四项功能尚未接入具体流程，仅作视觉反馈
        tile.classList.add('is-pressed');
        setTimeout(function () { tile.classList.remove('is-pressed'); }, 260);
      });
    });
  })();

  /* ==========================================================================
     动态页 —— 身份行头像/昵称与顶栏联动；封面可点击自定义；
     "落笔"发布动态为真实交互：文字+图片 → 写入 LunaDB → 渲染进
     故事环与信息流，刷新后由 LunaDB 恢复，不再是纯占位动画。
  ========================================================================== */
  (function initMoments() {
    var avatarEl = document.getElementById('momentsAvatar');
    var nameEl = document.getElementById('momentsName');
    var subEl = document.getElementById('momentsSub');
    var topComposeBtn = document.getElementById('momentsComposeBtn');
    var quickComposeBtn = document.getElementById('momentsQuickCompose');
    var refreshBtn = document.getElementById('momentsRefreshBtn');

    // 刷新印占位交互：点击后刻度环芯部旋转一整圈作为反馈，
    // 后续接入真实的"拉取最新动态"逻辑时在此处补充数据请求
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        if (refreshBtn.classList.contains('is-spinning')) return;
        refreshBtn.classList.add('is-spinning');
        setTimeout(function () { refreshBtn.classList.remove('is-spinning'); }, 560);
      });
    }

    var currentIdentity = { name: '用户昵称', avatar: null };

    function applyIdentityToMoments(saved) {
      if (!saved) return;
      if (saved.name) currentIdentity.name = saved.name;
      if (saved.avatar) currentIdentity.avatar = saved.avatar;
      if (saved.name && nameEl) nameEl.textContent = saved.name;
      if (saved.avatar && avatarEl) {
        avatarEl.innerHTML = '<img src="' + saved.avatar + '" alt="" /><span class="mo-identity-avatar-ring" aria-hidden="true"></span>';
      }
      syncMineStoryAvatar();
    }

    /* ---- "我的动态"占位头像同步：不再单独发起第二次 LunaDB 读取，
       直接从身份区头像 <img> 的当前 DOM 状态克隆过去——避免任何
       异步时序差异导致的不同步问题，只要身份头像区已经渲染出图片，
       占位环就一定跟着更新，两处永远是同一份数据、同一时刻同步 ---- */
    function syncMineStoryAvatar() {
      var mineAvatarEl = document.getElementById('momentsStoryMineAvatar');
      if (!mineAvatarEl) return;
      var srcImg = avatarEl ? avatarEl.querySelector('img') : null;
      var src = (srcImg && srcImg.src) || currentIdentity.avatar;
      if (src) {
        mineAvatarEl.innerHTML = '<img src="' + src + '" alt="" />';
      }
    }

    if (window.LunaDB) {
      LunaDB.get('identity').then(applyIdentityToMoments);
    }

    /* ---- 封面：点击上传/更换，持久化保存 ----
       真正的封面视觉画在 .moments-cover-veil（状态栏/顶栏/封面
       共用的统一背景层），.mo-cover 只是内容流里的透明占位热区，
       二者必须同步渲染同一张图，否则又会割裂成两截 */
    var coverBtn = document.getElementById('momentsCoverBtn');
    var coverVeilFrame = document.getElementById('momentsCoverVeilFrame');
    var coverFileInput = document.getElementById('momentsCoverFileInput');

    function applyCoverImage(dataUrl) {
      if (!coverVeilFrame) return;
      var img = coverVeilFrame.querySelector('img');
      if (!img) {
        img = document.createElement('img');
        img.alt = '';
        coverVeilFrame.appendChild(img);
      }
      img.src = dataUrl;
      coverVeilFrame.classList.add('has-photo');
    }

    if (window.LunaDB) {
      LunaDB.get('momentsCover').then(function (saved) {
        if (saved) applyCoverImage(saved);
      });
    }

    if (coverBtn && coverFileInput) {
      coverBtn.addEventListener('click', function () { coverFileInput.click(); });
      coverBtn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); coverFileInput.click(); }
      });
      coverFileInput.addEventListener('change', function () {
        var file = coverFileInput.files && coverFileInput.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (e) {
          var dataUrl = e.target.result;
          applyCoverImage(dataUrl);
          if (window.LunaDB) LunaDB.set('momentsCover', dataUrl);
        };
        reader.readAsDataURL(file);
        coverFileInput.value = '';
      });
    }

    /* ---- 发布动态弹窗 ---- */
    var composeModal = document.getElementById('composeModal');
    var composeScrim = document.getElementById('composeScrim');
    var composeTextarea = document.getElementById('composeTextarea');
    var composePhotoGrid = document.getElementById('composePhotoGrid');
    var composePhotoAdd = document.getElementById('composePhotoAdd');
    var composePhotoInput = document.getElementById('composePhotoInput');
    var composeSubmit = document.getElementById('composeSubmit');
    var composeAuthorName = document.getElementById('composeAuthorName');
    var composeAuthorAvatar = document.getElementById('composeAuthorAvatar');
    var storyRow = document.getElementById('momentsStoryRow');
    var feedEl = document.getElementById('momentsFeed');
    var feedEmptyEl = document.getElementById('momentsFeedEmpty');

    var draftPhotos = []; // dataURLs for current compose session
    var MAX_PHOTOS = 9;

    function openComposeModal() {
      if (!composeModal) return;
      composeModal.classList.add('open');
      if (composeAuthorName) composeAuthorName.textContent = currentIdentity.name;
      if (composeAuthorAvatar && currentIdentity.avatar) {
        composeAuthorAvatar.innerHTML = '<img src="' + currentIdentity.avatar + '" alt="" />';
      }
    }
    function closeComposeModal() {
      if (!composeModal) return;
      composeModal.classList.remove('open');
    }

    if (topComposeBtn) topComposeBtn.addEventListener('click', openComposeModal);
    if (quickComposeBtn) quickComposeBtn.addEventListener('click', openComposeModal);
    if (composeScrim) composeScrim.addEventListener('click', closeComposeModal);

    // "我的动态"占位位：点击直接唤起发布弹窗，符合"+"角标的直觉语义
    var mineStoryItem = document.querySelector('.mo-story-item-mine');
    if (mineStoryItem) mineStoryItem.addEventListener('click', openComposeModal);

    // "See all"：滚动到下方信息流区域，暂不引入单独的"全部动态"页面
    var seeAllBtn = document.getElementById('momentsStorySeeAll');
    if (seeAllBtn) {
      seeAllBtn.addEventListener('click', function () {
        var feedHead = document.querySelector('.mo-feed-head');
        if (feedHead && feedHead.scrollIntoView) {
          feedHead.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }

    function renderPhotoGrid() {
      if (!composePhotoGrid || !composePhotoAdd) return;
      Array.prototype.slice.call(composePhotoGrid.querySelectorAll('.compose-photo-item')).forEach(function (n) { n.remove(); });
      draftPhotos.forEach(function (dataUrl, idx) {
        var item = document.createElement('div');
        item.className = 'compose-photo-item';
        var img = document.createElement('img');
        img.src = dataUrl;
        img.alt = '';
        var removeBtn = document.createElement('button');
        removeBtn.className = 'compose-photo-remove';
        removeBtn.innerHTML = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M5 5L19 19M19 5L5 19" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
        removeBtn.addEventListener('click', function () {
          draftPhotos.splice(idx, 1);
          renderPhotoGrid();
        });
        item.appendChild(img);
        item.appendChild(removeBtn);
        composePhotoGrid.insertBefore(item, composePhotoAdd);
      });
      composePhotoAdd.style.display = draftPhotos.length >= MAX_PHOTOS ? 'none' : 'flex';
    }

    if (composePhotoAdd && composePhotoInput) {
      composePhotoAdd.addEventListener('click', function () { composePhotoInput.click(); });
      composePhotoInput.addEventListener('change', function () {
        var files = Array.prototype.slice.call(composePhotoInput.files || []);
        var remaining = MAX_PHOTOS - draftPhotos.length;
        files.slice(0, remaining).forEach(function (file) {
          var reader = new FileReader();
          reader.onload = function (e) {
            draftPhotos.push(e.target.result);
            renderPhotoGrid();
          };
          reader.readAsDataURL(file);
        });
        composePhotoInput.value = '';
      });
    }

    function formatPostTime(ts) {
      var d = new Date(ts);
      var mm = d.getMonth() + 1;
      var dd = d.getDate();
      var hh = String(d.getHours()).padStart(2, '0');
      var mi = String(d.getMinutes()).padStart(2, '0');
      return mm + '月' + dd + '日 · ' + hh + ':' + mi;
    }

    function buildPostCard(post) {
      var card = document.createElement('div');
      card.className = 'mo-post';

      var head = document.createElement('div');
      head.className = 'mo-post-head';
      var avatar = document.createElement('div');
      avatar.className = 'mo-post-avatar';
      if (post.avatar) avatar.innerHTML = '<img src="' + post.avatar + '" alt="" />';
      var col = document.createElement('div');
      col.className = 'mo-post-head-col';
      var nameSpan = document.createElement('span');
      nameSpan.className = 'mo-post-name';
      nameSpan.textContent = post.name || '用户昵称';
      var timeSpan = document.createElement('span');
      timeSpan.className = 'mo-post-time';
      timeSpan.textContent = formatPostTime(post.ts);
      col.appendChild(nameSpan);
      col.appendChild(timeSpan);
      head.appendChild(avatar);
      head.appendChild(col);
      card.appendChild(head);

      if (post.text) {
        var textEl = document.createElement('div');
        textEl.className = 'mo-post-text';
        textEl.textContent = post.text;
        card.appendChild(textEl);
      }

      if (post.photos && post.photos.length) {
        var photosEl = document.createElement('div');
        photosEl.className = 'mo-post-photos';
        photosEl.setAttribute('data-count', String(post.photos.length));
        post.photos.forEach(function (src) {
          var ph = document.createElement('div');
          ph.className = 'mo-post-photo';
          var img = document.createElement('img');
          img.src = src;
          img.alt = '';
          ph.appendChild(img);
          photosEl.appendChild(ph);
        });
        card.appendChild(photosEl);
      }

      return card;
    }

    function buildStoryItem(post) {
      var item = document.createElement('div');
      item.className = 'mo-story-item';
      var avatarBox = document.createElement('div');
      avatarBox.className = 'mo-story-item-ring';
      var avatarMask = document.createElement('div');
      avatarMask.className = 'mo-story-item-ring-mask';
      var avatar = document.createElement('div');
      avatar.className = 'mo-story-item-avatar';
      if (post.avatar) avatar.innerHTML = '<img src="' + post.avatar + '" alt="" />';
      avatarMask.appendChild(avatar);
      avatarBox.appendChild(avatarMask);
      var nameEl2 = document.createElement('span');
      nameEl2.className = 'mo-story-item-name';
      nameEl2.textContent = post.name || '用户昵称';
      item.appendChild(avatarBox);
      item.appendChild(nameEl2);
      return item;
    }

    function buildFriendStoryItem(f) {
      var item = document.createElement('div');
      // 好友项默认即"暂无动态"状态——单圈浅灰描边（is-read），
      // 不参与"N new"未读计数，纯粹展示"这是我的好友"这一身份，
      // 等好友真的发布内容后再切换成有缺口的未读态描边
      item.className = 'mo-story-item is-read';
      item.dataset.friendItem = 'true';
      var avatarBox = document.createElement('div');
      avatarBox.className = 'mo-story-item-ring';
      var avatarMask = document.createElement('div');
      avatarMask.className = 'mo-story-item-ring-mask';
      var avatar = document.createElement('div');
      avatar.className = 'mo-story-item-avatar';
      var letter = (f.name || '?').charAt(0);
      avatar.innerHTML = f.avatar
        ? '<img src="' + f.avatar + '" alt="" />'
        : '<span class="mo-story-item-letter">' + letter + '</span>';
      avatarMask.appendChild(avatar);
      avatarBox.appendChild(avatarMask);
      var nameEl2 = document.createElement('span');
      nameEl2.className = 'mo-story-item-name';
      nameEl2.textContent = f.name || '未命名好友';
      item.appendChild(avatarBox);
      item.appendChild(nameEl2);
      return item;
    }

    /* ---- 好友环同步：从 LunaFriends 读取全部好友（去重），紧跟在
       "我的动态"占位位之后铺开。默认展示为"暂无动态"的单圈灰环，
       与好友是否真的发过动态无关——这只是"好友存在"的身份展示位，
       与好友页数据完全同源，好友页增删好友后这里会跟着刷新 ---- */
    function renderFriendStoryItems() {
      if (!storyRow) return;
      Array.prototype.slice.call(storyRow.querySelectorAll('.mo-story-item[data-friend-item="true"]')).forEach(function (n) { n.remove(); });

      if (!window.LunaFriends || !Array.isArray(window.LunaFriends.groups)) return;
      var seen = {};
      var list = [];
      window.LunaFriends.groups.forEach(function (g) {
        (g.friends || []).forEach(function (f) {
          var key = f.charId != null ? ('c:' + f.charId) : ('n:' + f.name);
          if (seen[key]) return;
          seen[key] = true;
          list.push(f);
        });
      });

      var mineEl = storyRow.querySelector('.mo-story-item-mine');
      list.forEach(function (f) {
        var el = buildFriendStoryItem(f);
        if (mineEl && mineEl.nextSibling) {
          storyRow.insertBefore(el, mineEl.nextSibling);
        } else {
          storyRow.appendChild(el);
        }
      });
    }

    function renderMomentsFeed(posts) {
      if (!feedEl) return;
      Array.prototype.slice.call(feedEl.querySelectorAll('.mo-post')).forEach(function (n) { n.remove(); });
      if (!posts || !posts.length) {
        if (feedEmptyEl) feedEmptyEl.style.display = 'flex';
        // "我的动态"占位位始终常驻，不随信息流是否为空而改变——
        // 具体渲染见下方 storyRow 分支，此处提前 return 只是跳过
        // 信息流卡片的绘制，故事带仍会走到下面统一刷新
      } else {
        if (feedEmptyEl) feedEmptyEl.style.display = 'none';
        // 信息流：最新在前
        posts.slice().reverse().forEach(function (post) {
          feedEl.appendChild(buildPostCard(post));
        });
      }

      // 故事环：固定"我的动态"占位项 → 好友占位项（暂无动态状态）
      // → 用户自己发布过的历史动态，三段依次排布，互不覆盖
      if (storyRow) {
        Array.prototype.slice.call(storyRow.querySelectorAll('.mo-story-item:not(.mo-story-item-mine):not([data-friend-item="true"])')).forEach(function (n) { n.remove(); });
        if (posts && posts.length) {
          posts.slice().reverse().forEach(function (post) {
            storyRow.appendChild(buildStoryItem(post));
          });
        }
        renderFriendStoryItems();
      }

      var newCountEl = document.getElementById('momentsStoryNewCount');
      if (newCountEl) newCountEl.textContent = (posts ? posts.length : 0) + ' new';
    }

    if (window.LunaDB) {
      LunaDB.get('momentsPosts').then(function (saved) {
        renderMomentsFeed(saved && saved.length ? saved : null);
      });
    }

    // 好友数据变更（好友页新增/删除好友）时，实时刷新故事环里的
    // 好友占位项，不需要用户手动刷新或切换页面才能看到
    document.addEventListener('luna:friends-changed', renderFriendStoryItems);

    function submitPost() {
      var text = composeTextarea ? composeTextarea.value.trim() : '';
      if (!text && draftPhotos.length === 0) return;

      var post = {
        ts: Date.now(),
        name: currentIdentity.name,
        avatar: currentIdentity.avatar,
        text: text,
        photos: draftPhotos.slice()
      };

      if (window.LunaDB) {
        LunaDB.get('momentsPosts').then(function (saved) {
          var posts = saved && saved.length ? saved : [];
          posts.push(post);
          LunaDB.set('momentsPosts', posts);
          renderMomentsFeed(posts);
        });
      } else {
        renderMomentsFeed([post]);
      }

      if (subEl) subEl.textContent = '刚刚更新了动态';

      // 清空草稿并关闭弹窗
      draftPhotos = [];
      if (composeTextarea) composeTextarea.value = '';
      renderPhotoGrid();
      closeComposeModal();
    }

    if (composeSubmit) composeSubmit.addEventListener('click', submitPost);

    renderPhotoGrid();
  })();

  window.LunaChatApp = {
    goTo: activatePage
  };
})();