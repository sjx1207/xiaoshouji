/* ==========================================================================
   Call Log — calllog.js
   通话记录占位页交互逻辑：
   - 入口守卫：与 chatroom.js / chatsetting.js / chatlog.js 共用同一份
     会话令牌（sessionStorage），直接以 URL 打开本页时展示拦截层。
   - 目前不接入任何通话数据源（功能尚未上线），仅同步状态栏 / 灵动岛 /
     对方昵称等与其它页面通用的展示元素，保证访问路径与视觉体验
     与聊天记录页完全一致，待通话功能上线后再在此基础上接入真实
     LunaDB 数据（约定 key 前缀可复用 'callLog:' + charId/name，
     与 chatroom:/translationLink: 等 key 同一套命名规范）。
========================================================================== */
(function () {
  'use strict';

  var SESSION_KEY = 'luna_chat_session';

  document.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') init();

  function init() {
    var session = readSession();
    if (!session) {
      document.body.setAttribute('data-crm-guard', 'blocked');
      return;
    }
    document.body.setAttribute('data-crm-guard', 'ok');

    var peerLine = document.getElementById('cll2PeerLine');
    if (peerLine) peerLine.textContent = '与「' + (session.name || '好友') + '」的通话往来';

    var backBtn = document.getElementById('cll2BackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        if (window.history.length > 1) window.history.back();
        else window.location.href = 'chatsetting.html';
      });
    }

    /* ---- 状态栏同步：与其余聊天相关页面完全一致的读取方式 ---- */
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

    /* ---- 灵动岛同步：与其余聊天相关页面完全一致 ---- */
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
          clock:   '<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="cll2SiClockText">--:--</span></div></div>',
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
            var t = document.getElementById('cll2SiClockText');
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
})();
