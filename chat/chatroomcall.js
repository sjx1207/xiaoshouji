/* ==========================================================================
   chatroomcall.js —— 视频通话 · 呼叫页控制器

   本轮重写要点：
   1. 【按反馈彻底删除"已接通"模拟】真实场景里，呼叫方在对方接听
      之前只会看到"呼叫中 + 挂断"这一个状态，不会有假的计时器、
      静音/摄像头三键条。本文件不再包含任何 setState('connected')
      或定时切换逻辑——从打开到挂断，全程只有一种呼叫中样式。
   2. 【HTML 内联注入，不再 fetch】旧版用 fetch('chatroomcall.html')
      拉取本地文件，file:// 协议下会被 CORS 静默拦截导致注入失败、
      页面空白。现在把结构直接内联为字符串模板，注入不依赖网络。
   3. 【如果你更新文件后页面样式仍未变化】大概率是浏览器/宿主环境
      缓存了旧的 chatroomcall.js —— 本文件顶部没有版本号可比对，
      请在测试时用浏览器"强制刷新"（Ctrl/Cmd+Shift+R）或加上
      ?v=时间戳 的方式清缓存后再试。
   4. 视觉：中心肖像外的"蚀环"是签名动效——旋转 + 呼吸粗细的银白
      细环，环上缀着独立闪烁的星尘光点；挂断时环骤然向内收拢淡出，
      肖像微微收缩，作为关闭前的一次仪式感反馈，随后整页淡出关闭。
   5. window.__crmOpenCallPage 入口不变，与 chatroom.js 里视频卡的
      点击绑定完全兼容，无需改动 chatroom.js。
========================================================================== */
(function () {
  'use strict';

  var COLOR_MAP = {
    ink:   { avBg: 'linear-gradient(155deg,#3a3a3e,#17171a)', avCol: 'rgba(255,255,255,0.92)' },
    slate: { avBg: 'linear-gradient(155deg,#4b4f57,#22252b)', avCol: 'rgba(255,255,255,0.92)' },
    smoke: { avBg: 'linear-gradient(155deg,#5a5a5e,#2a2a2c)', avCol: 'rgba(255,255,255,0.92)' }
  };

  var MARKUP = ''
    + '<div class="ccv2-veil" id="ccv2Veil" aria-hidden="true"></div>'
    + '<div class="ccv2-page" id="ccv2Page" aria-hidden="true">'
    +   '<div class="ccv2-stage" id="ccv2Stage">'
    +     '<div class="ccv2-stage-bg" id="ccv2StageBg" aria-hidden="true"></div>'
    +     '<div class="ccv2-stage-grain" aria-hidden="true"></div>'
    +     '<div class="ccv2-stage-veil" aria-hidden="true"></div>'
    +     '<div class="status-bar ccv2-status">'
    +       '<div class="status-time" id="ccv2StatusTime">9:41</div>'
    +       '<div class="status-island"><div class="si-capsule si-minimal-capsule"></div></div>'
    +       '<div class="status-right">'
    +         '<div class="signal"><i></i><i></i><i></i><i></i></div>'
    +         '<div class="battery">'
    +           '<span class="bat-pct" id="ccv2BatPct">76</span>'
    +           '<div class="bat-shell"><div class="bat-inner" id="ccv2BatInner"></div><div class="bat-nub"></div></div>'
    +         '</div>'
    +       '</div>'
    +     '</div>'
    +     '<div class="ccv2-kicker">'
    +       '<span class="ccv2-kicker-dot" aria-hidden="true"></span>'
    +       '<span class="ccv2-kicker-cn">正在呼叫</span>'
    +       '<span class="ccv2-kicker-en">CALLING&nbsp;VIDEO</span>'
    +     '</div>'
    +     '<div class="ccv2-center">'
    +       '<div class="ccv2-rays" aria-hidden="true"></div>'
    +       '<div class="ccv2-corona-wrap" id="ccv2CoronaWrap">'
    +         '<svg class="ccv2-corona" viewBox="0 0 240 240" aria-hidden="true">'
    +           '<circle class="ccv2-corona-track" cx="120" cy="120" r="104"></circle>'
    +           '<circle class="ccv2-corona-arc" cx="120" cy="120" r="104"></circle>'
    +           '<g class="ccv2-corona-dots" id="ccv2CoronaDots"></g>'
    +         '</svg>'
    +         '<div class="ccv2-portrait" id="ccv2Portrait"><span class="ccv2-portrait-glyph" id="ccv2PortraitGlyph"></span></div>'
    +       '</div>'
    +       '<div class="ccv2-idcard">'
    +         '<div class="ccv2-name" id="ccv2Name">好友昵称</div>'
    +         '<div class="ccv2-sub">正在接通……</div>'
    +       '</div>'
    +     '</div>'
    +     '<div class="ccv2-solo-row">'
    +       '<button class="ccv2-solo-hangup" id="ccv2SoloHangupBtn" type="button" aria-label="取消呼叫">'
    +         '<span class="ccv2-solo-hangup-ring" aria-hidden="true"></span>'
    +         '<span class="ccv2-solo-hangup-ring ccv2-ring-b" aria-hidden="true"></span>'
    +         '<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M3.8 13.4C7 8.9 17 8.9 20.2 13.4C20.6 14 20.5 14.8 19.9 15.2L17.1 17.2C16.5 17.6 15.7 17.5 15.3 16.9L14.2 15.3C13.9 14.9 13.3 14.7 12.9 15L11.6 15.9C11.2 16.2 10.6 16.1 10.3 15.7L9 13.9C8.7 13.5 8.1 13.4 7.7 13.7L4.9 15.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" transform="rotate(135 12 13)"/></svg>'
    +       '</button>'
    +       '<span class="ccv2-solo-label">取消呼叫</span>'
    +     '</div>'
    +   '</div>'
    + '</div>';

  function getSession() {
    var s = window.__crmChatroomSession;
    if (s && typeof s === 'object') return s;
    var nameEl = document.getElementById('crmPeerName');
    var avatarImg = document.querySelector('#crmPeerAvatar img');
    return {
      name: nameEl ? nameEl.textContent : '好友',
      avatar: avatarImg ? avatarImg.src : '',
      color: 'ink'
    };
  }

  function injectMarkup() {
    if (document.getElementById('ccv2Page')) return;
    var host = document.querySelector('.phone-frame') || document.body;
    var wrap = document.createElement('div');
    wrap.innerHTML = MARKUP;
    while (wrap.firstChild) host.appendChild(wrap.firstChild);
  }

  // 生成蚀环上的随机星尘光点，围绕圆心均匀散布并各自独立闪烁
  function buildCoronaDust(container) {
    if (!container || container.childNodes.length) return;
    var cx = 120, cy = 120, r = 104;
    var count = 22;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < count; i++) {
      var angle = (Math.PI * 2 * i) / count + (Math.random() * 0.18 - 0.09);
      var rr = r + (Math.random() * 6 - 3);
      var x = cx + Math.cos(angle) * rr;
      var y = cy + Math.sin(angle) * rr;
      var dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', x.toFixed(1));
      dot.setAttribute('cy', y.toFixed(1));
      dot.setAttribute('r', (0.9 + Math.random() * 1.3).toFixed(2));
      dot.style.animationDelay = (Math.random() * 2.4).toFixed(2) + 's';
      dot.style.animationDuration = (1.8 + Math.random() * 1.6).toFixed(2) + 's';
      frag.appendChild(dot);
    }
    container.appendChild(frag);
  }

  function init() {
    var els = {
      veil: document.getElementById('ccv2Veil'),
      page: document.getElementById('ccv2Page'),
      stageBg: document.getElementById('ccv2StageBg'),
      statusTime: document.getElementById('ccv2StatusTime'),
      batPct: document.getElementById('ccv2BatPct'),
      batInner: document.getElementById('ccv2BatInner'),
      coronaDots: document.getElementById('ccv2CoronaDots'),
      portrait: document.getElementById('ccv2Portrait'),
      portraitGlyph: document.getElementById('ccv2PortraitGlyph'),
      name: document.getElementById('ccv2Name'),
      soloHangupBtn: document.getElementById('ccv2SoloHangupBtn')
    };
    if (!els.veil || !els.page) return;
    if (els.page.getAttribute('data-ccv2-inited') === '1') return;
    els.page.setAttribute('data-ccv2-inited', '1');

    buildCoronaDust(els.coronaDots);

    var closeTimer = null;

    function syncStatusBar() {
      if (els.statusTime) {
        var tz = 'Asia/Shanghai';
        try { tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai'; } catch (e) {}
        els.statusTime.textContent = new Date().toLocaleTimeString('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
      }
      if (els.batPct && els.batInner) {
        var pct = 76;
        try {
          var saved = localStorage.getItem('luna_battery');
          if (saved !== null && !isNaN(parseInt(saved, 10))) pct = Math.max(1, Math.min(100, parseInt(saved, 10)));
        } catch (e) {}
        els.batPct.textContent = pct;
        els.batInner.style.width = pct + '%';
      }
    }

    function applyPortrait() {
      var session = getSession();
      if (els.name) els.name.textContent = session.name || '好友';
      var col = COLOR_MAP[session.color] || COLOR_MAP.ink;
      if (!els.portrait) return;
      var existingImg = els.portrait.querySelector('img');
      if (existingImg) existingImg.remove();
      if (session.avatar) {
        els.portrait.style.background = 'none';
        if (els.portraitGlyph) els.portraitGlyph.style.display = 'none';
        var img = document.createElement('img');
        img.src = session.avatar;
        img.alt = '';
        els.portrait.insertBefore(img, els.portrait.firstChild);
        if (els.stageBg) els.stageBg.style.backgroundImage = 'url(' + session.avatar + ')';
      } else {
        els.portrait.style.background = col.avBg;
        if (els.portraitGlyph) {
          els.portraitGlyph.style.display = '';
          els.portraitGlyph.style.color = col.avCol;
          els.portraitGlyph.textContent = (session.name || '?').charAt(0);
        }
        if (els.stageBg) els.stageBg.style.backgroundImage = 'none';
      }
    }

    function open() {
      applyPortrait();
      syncStatusBar();
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
      els.page.classList.remove('is-closing');

      els.veil.classList.add('is-open');
      els.page.classList.add('is-open');
      els.veil.setAttribute('aria-hidden', 'false');
      els.page.setAttribute('aria-hidden', 'false');
      document.addEventListener('keydown', onKeydown);
    }

    function close() {
      // 挂断的一次性反馈：蚀环收拢、肖像微缩，随后整页淡出
      els.page.classList.add('is-closing');
      document.removeEventListener('keydown', onKeydown);
      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = setTimeout(function () {
        els.veil.classList.remove('is-open');
        els.page.classList.remove('is-open');
        els.veil.setAttribute('aria-hidden', 'true');
        els.page.setAttribute('aria-hidden', 'true');
        els.page.classList.remove('is-closing');
      }, 260);
    }

    function onKeydown(evt) {
      if (evt.key === 'Escape') close();
    }

    if (els.soloHangupBtn) els.soloHangupBtn.addEventListener('click', close);

    window.__crmOpenCallPage = open;
    window.__crmCloseCallPage = close;
  }

  function boot() {
    injectMarkup();
    init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();