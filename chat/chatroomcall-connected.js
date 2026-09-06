/* ==========================================================================
   chatroomcall-connected.js —— 视频通话 · 接通页控制器 v4

   本轮为「浅色高级玻璃系」视觉重制版，逻辑与 v3 保持一致，仅同步
   更新了字符串模板中的 SVG 图标（改为线宽 2px、更饱满的几何造型，
   与新版 CSS 的放大尺寸配套），并保留自拍小窗、输入条展开/收起、
   AI 占位按钮等既有交互结构。

   衔接方式与此前一致：包装 window.__crmOpenCallPage，呼叫中页
   停顿 SIMULATED_RING_MS 毫秒后自动切到本页；真实场景应替换为
   "对方已接听"的信令回调。
========================================================================== */
(function () {
  'use strict';

  var MARKUP = ''
    + '<div class="ccv3-page" id="ccv3Page" aria-hidden="true">'
    +   '<div class="ccv3-stage" id="ccv3Stage">'
    +     '<div class="ccv3-video" id="ccv3Video" aria-hidden="true"></div>'
    +     '<div class="ccv3-video-grain" aria-hidden="true"></div>'
    +     '<div class="ccv3-video-veil-top" aria-hidden="true"></div>'
    +     '<div class="ccv3-video-veil-bottom" aria-hidden="true"></div>'
    +     '<div class="ccv3-aura" aria-hidden="true"></div>'
    +     '<div class="status-bar ccv3-status">'
    +       '<div class="status-time" id="ccv3StatusTime">9:41</div>'
    +       '<div class="status-island"><div class="si-capsule si-minimal-capsule"></div></div>'
    +       '<div class="status-right">'
    +         '<div class="signal"><i></i><i></i><i></i><i></i></div>'
    +         '<div class="battery">'
    +           '<span class="bat-pct" id="ccv3BatPct">76</span>'
    +           '<div class="bat-shell"><div class="bat-inner" id="ccv3BatInner"></div><div class="bat-nub"></div></div>'
    +         '</div>'
    +       '</div>'
    +     '</div>'
    +     '<div class="ccv3-topbar">'
    +       '<div class="ccv3-topbar-row">'
    +         '<div class="ccv3-peer-chip-wrap">'
    +           '<div class="ccv3-peer-chip-halo" aria-hidden="true"></div>'
    +           '<div class="ccv3-peer-chip-ring" aria-hidden="true"></div>'
    +           '<div class="ccv3-peer-chip" id="ccv3PeerChip" aria-hidden="true">'
    +             '<span class="ccv3-peer-chip-glyph" id="ccv3PeerChipGlyph"></span>'
    +           '</div>'
    +         '</div>'
    +       '</div>'
    +       '<div class="ccv3-topbar-text">'
    +         '<div class="ccv3-topbar-name" id="ccv3Name">好友昵称</div>'
    +         '<div class="ccv3-topbar-status">'
    +           '<span class="ccv3-live-dot" aria-hidden="true"></span><span>已接通</span>'
    +           '<span class="ccv3-timer" id="ccv3Timer">00:00</span>'
    +         '</div>'
    +       '</div>'
    +     '</div>'
    +     '<div class="ccv3-selfie-halo" aria-hidden="true"></div>'
    +     '<div class="ccv3-selfie" id="ccv3Selfie" aria-hidden="true">'
    +       '<span class="ccv3-selfie-spark" aria-hidden="true"></span>'
    +       '<div class="ccv3-selfie-inner" id="ccv3SelfieInner">'
    +         '<div class="ccv3-selfie-placeholder" id="ccv3SelfiePlaceholder">'
    +           '<svg width="30" height="30" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8.5" r="3.6" fill="currentColor"/><path d="M5 19.2c0-3.4 3.1-5.7 7-5.7s7 2.3 7 5.7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
    +           '<span>NO SIGNAL</span>'
    +         '</div>'
    +       '</div>'
    +     '</div>'
    +     '<div class="ccv3-transcript" id="ccv3Transcript">'
    +       '<div class="ccv3-transcript-inner" id="ccv3TranscriptInner"></div>'
    +     '</div>'
    +     '<div class="ccv3-input-bar" id="ccv3InputBar">'
    +       '<div class="ccv3-input-wrap" id="ccv3InputWrap">'
    +         '<input class="ccv3-input" id="ccv3Input" type="text" placeholder="说点什么……" aria-label="输入内容" />'
    +       '</div>'
    +       '<button class="ccv3-send-btn" id="ccv3SendBtn" type="button" aria-label="发送">'
    +         '<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M3.5 12L21 3.5L14.5 20.5C14.15 21.35 12.9 21.3 12.62 20.43L10.5 13.5L3.5 12Z" fill="currentColor"/><path d="M10.5 13.5L21 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'
    +       '</button>'
    +       '<button class="ccv3-ai-btn" id="ccv3AiBtn" type="button" aria-label="AI 回复">'
    +         '<span class="ccv3-ai-btn-mark" aria-hidden="true"></span><span class="ccv3-ai-btn-label">AI</span>'
    +       '</button>'
    +     '</div>'
    +     '<div class="ccv3-dock" id="ccv3Dock">'
    +       '<button class="ccv3-dock-btn" id="ccv3KbToggle" type="button" aria-label="展开输入">'
    +         '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="2.5" y="6" width="19" height="13" rx="3.5" stroke="currentColor" stroke-width="2"/><circle cx="7" cy="11" r="1.15" fill="currentColor"/><circle cx="11" cy="11" r="1.15" fill="currentColor"/><circle cx="15" cy="11" r="1.15" fill="currentColor"/><circle cx="17.5" cy="11" r="1.15" fill="currentColor"/><path d="M6.5 14.6h11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
    +       '</button>'
    +       '<button class="ccv3-hangup-btn" id="ccv3HangupBtn" type="button" aria-label="挂断">'
    +         '<span class="ccv3-hangup-ring" aria-hidden="true"></span>'
    +         '<svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M2.5 8.6C7.2 4 16.8 4 21.5 8.6C21.9 9 21.9 9.6 21.5 10L18.6 12.4C18.2 12.7 17.7 12.7 17.3 12.4L15.1 10.7C14.8 10.4 14.3 10.4 13.9 10.6C13.3 10.9 12.65 11.05 12 11.05C11.35 11.05 10.7 10.9 10.1 10.6C9.7 10.4 9.2 10.4 8.9 10.7L6.7 12.4C6.3 12.7 5.8 12.7 5.4 12.4L2.5 10C2.1 9.6 2.1 9 2.5 8.6Z" fill="currentColor" transform="rotate(135 12 10.3)"/></svg>'
    +       '</button>'
    +       '<button class="ccv3-dock-btn" id="ccv3SettingsBtn" type="button" aria-label="设置">'
    +         '<svg width="23" height="23" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="2"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1M18.5 18.5l-2.1-2.1M7.6 7.6L5.5 5.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
    +       '</button>'
    +     '</div>'
    +   '</div>'
    + '</div>';

  // 呼叫中 → 接通 的模拟停顿时长（毫秒）。真实场景应替换为信令回调。
  var SIMULATED_RING_MS = 2600;

  function getSession() {
    var s = window.__crmChatroomSession;
    if (s && typeof s === 'object') return s;
    var nameEl = document.getElementById('crmPeerName');
    var avatarImg = document.querySelector('#crmPeerAvatar img');
    var selfAvatarImg = document.querySelector('#crmSelfAvatar img');
    return {
      name: nameEl ? nameEl.textContent : '好友',
      avatar: avatarImg ? avatarImg.src : '',
      selfAvatar: selfAvatarImg ? selfAvatarImg.src : '',
      color: 'ink'
    };
  }

  function injectMarkup() {
    if (document.getElementById('ccv3Page')) return;
    var host = document.querySelector('.phone-frame') || document.body;
    var wrap = document.createElement('div');
    wrap.innerHTML = MARKUP;
    while (wrap.firstChild) host.appendChild(wrap.firstChild);
  }

  function init() {
    var els = {
      page: document.getElementById('ccv3Page'),
      video: document.getElementById('ccv3Video'),
      selfieInner: document.getElementById('ccv3SelfieInner'),
      statusTime: document.getElementById('ccv3StatusTime'),
      batPct: document.getElementById('ccv3BatPct'),
      batInner: document.getElementById('ccv3BatInner'),
      name: document.getElementById('ccv3Name'),
      peerChip: document.getElementById('ccv3PeerChip'),
      peerChipGlyph: document.getElementById('ccv3PeerChipGlyph'),
      timer: document.getElementById('ccv3Timer'),
      hangupBtn: document.getElementById('ccv3HangupBtn'),
      settingsBtn: document.getElementById('ccv3SettingsBtn'),
      transcript: document.getElementById('ccv3Transcript'),
      transcriptInner: document.getElementById('ccv3TranscriptInner'),
      kbToggle: document.getElementById('ccv3KbToggle'),
      inputBar: document.getElementById('ccv3InputBar'),
      input: document.getElementById('ccv3Input'),
      sendBtn: document.getElementById('ccv3SendBtn'),
      aiBtn: document.getElementById('ccv3AiBtn')
    };
    if (!els.page) return;
    if (els.page.getAttribute('data-ccv3-inited') === '1') return;
    els.page.setAttribute('data-ccv3-inited', '1');

    var timerHandle = null;
    var elapsedSec = 0;
    var ringTimer = null;

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

    function applyVideo() {
      var session = getSession();
      if (els.name) els.name.textContent = session.name || '好友';
      if (els.video) {
        if (session.avatar) {
          els.video.style.backgroundImage = 'url(' + session.avatar + ')';
          els.video.classList.add('has-image');
        } else {
          els.video.style.backgroundImage = 'none';
          els.video.classList.remove('has-image');
        }
      }
      // 昵称胶囊左侧的头像徽标：取用与大背景同一张对方头像；若无
      // 头像可用，回退显示昵称首字，避免圆形区域出现空白
      if (els.peerChip) {
        if (session.avatar) {
          els.peerChip.style.backgroundImage = 'url(' + session.avatar + ')';
          els.peerChip.classList.add('has-image');
        } else {
          els.peerChip.style.backgroundImage = 'none';
          els.peerChip.classList.remove('has-image');
          if (els.peerChipGlyph) els.peerChipGlyph.textContent = (session.name || '?').charAt(0);
        }
      }
      // 自拍小窗：若会话提供了用户自己的头像（session.selfAvatar），
      // 用它填充自拍窗，制造"双人同框"的真实感；仅当确实没有可用
      // 头像时才回退到"NO SIGNAL"人形剪影占位。若后续接入
      // getUserMedia 真实摄像头流，可在此处把 <video> 插入
      // selfieInner 并加上 has-image 类以隐藏占位剪影。
      if (els.selfieInner) {
        if (session.selfAvatar) {
          els.selfieInner.classList.add('has-image');
          els.selfieInner.style.backgroundImage = 'url(' + session.selfAvatar + ')';
        } else {
          els.selfieInner.classList.remove('has-image');
          els.selfieInner.style.backgroundImage = 'none';
        }
      }
    }

    function formatTimer(sec) {
      var m = Math.floor(sec / 60), s = sec % 60;
      return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
    }

    function startTimer() {
      elapsedSec = 0;
      if (els.timer) els.timer.textContent = formatTimer(0);
      if (timerHandle) clearInterval(timerHandle);
      timerHandle = setInterval(function () {
        elapsedSec += 1;
        if (els.timer) els.timer.textContent = formatTimer(elapsedSec);
      }, 1000);
    }

    function stopTimer() {
      if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
    }

    function appendLine(type, text, dir) {
      if (!els.transcriptInner || !text) return;
      var row = document.createElement('div');
      if (type === 'narration') {
        // 旁白／动作描述：无气泡容器，左右配引导线 + 菱形分隔符，
        // 与对话气泡形成结构性区分，而不仅靠字体差异
        row.className = 'ccv3-line ccv3-line--narration';
        var wrap = document.createElement('div');
        wrap.className = 'ccv3-narration-wrap';
        var ruleL = document.createElement('span');
        ruleL.className = 'ccv3-narration-rule';
        var markL = document.createElement('span');
        markL.className = 'ccv3-narration-mark';
        var p = document.createElement('p');
        p.className = 'ccv3-narration-text';
        p.textContent = text;
        var markR = document.createElement('span');
        markR.className = 'ccv3-narration-mark';
        var ruleR = document.createElement('span');
        ruleR.className = 'ccv3-narration-rule';
        wrap.appendChild(ruleL);
        wrap.appendChild(markL);
        wrap.appendChild(p);
        wrap.appendChild(markR);
        wrap.appendChild(ruleR);
        row.appendChild(wrap);
      } else {
        var dirClass = dir === 'out' ? 'ccv3-line--out' : 'ccv3-line--in';
        row.className = 'ccv3-line ccv3-line--speech ' + dirClass;
        if (dir !== 'out') {
          var avatar = document.createElement('div');
          avatar.className = 'ccv3-speech-avatar';
          var session = getSession();
          if (session.avatar) avatar.style.backgroundImage = 'url(' + session.avatar + ')';
          row.appendChild(avatar);
        }
        var bubble = document.createElement('div');
        bubble.className = 'ccv3-bubble';
        var bp = document.createElement('p');
        bp.className = 'ccv3-bubble-text';
        bp.textContent = text;
        bubble.appendChild(bp);
        row.appendChild(bubble);
      }
      els.transcriptInner.appendChild(row);
      els.transcript.scrollTop = els.transcript.scrollHeight;
      return row;
    }

    // 输入中提示：三点跳动气泡，材质与对话气泡一致。同一时刻只保留
    // 一条提示——再次调用会先移除旧的，避免像宿主系统曾经出现的那样
    // 无样式的省略号气泡不断堆叠。会话真正开始回复时调用
    // hideTyping()（或直接 appendLine 新内容）即可清除。
    var typingRow = null;
    function showTyping(dir) {
      hideTyping();
      var dirClass = dir === 'out' ? 'ccv3-line--out' : 'ccv3-line--in';
      var row = document.createElement('div');
      row.className = 'ccv3-line ccv3-line--speech ' + dirClass;
      if (dir !== 'out') {
        var avatar = document.createElement('div');
        avatar.className = 'ccv3-speech-avatar';
        var session = getSession();
        if (session.avatar) avatar.style.backgroundImage = 'url(' + session.avatar + ')';
        row.appendChild(avatar);
      }
      var bubble = document.createElement('div');
      bubble.className = 'ccv3-bubble ccv3-bubble--typing';
      var dots = document.createElement('div');
      dots.className = 'ccv3-typing-dots';
      dots.innerHTML = '<span></span><span></span><span></span>';
      bubble.appendChild(dots);
      row.appendChild(bubble);
      els.transcriptInner.appendChild(row);
      els.transcript.scrollTop = els.transcript.scrollHeight;
      typingRow = row;
      return row;
    }
    function hideTyping() {
      if (typingRow && typingRow.parentNode) typingRow.parentNode.removeChild(typingRow);
      typingRow = null;
    }

    // 输入条展开/收起：浮在底部固定行上方，不替换它
    function openInputBar() {
      els.inputBar.classList.add('is-open');
      if (els.kbToggle) els.kbToggle.classList.add('is-active');
      if (els.input) setTimeout(function () { els.input.focus(); }, 60);
    }
    function closeInputBar() {
      if (els.input && els.input.value.trim()) return; // 有未发送内容时不自动收起
      els.inputBar.classList.remove('is-open');
      if (els.kbToggle) els.kbToggle.classList.remove('is-active');
      if (els.input) els.input.blur();
    }
    function toggleInputBar() {
      if (els.inputBar.classList.contains('is-open')) closeInputBar();
      else openInputBar();
    }

    function open() {
      applyVideo();
      syncStatusBar();
      startTimer();
      els.page.classList.remove('is-closing');
      els.page.classList.add('is-open');
      els.page.setAttribute('aria-hidden', 'false');
    }

    function close() {
      stopTimer();
      els.page.classList.remove('is-open');
      els.page.setAttribute('aria-hidden', 'true');
      closeInputBar();
      if (window.__crmCloseCallPage) window.__crmCloseCallPage();
    }

    if (els.hangupBtn) els.hangupBtn.addEventListener('click', close);
    if (els.kbToggle) els.kbToggle.addEventListener('click', toggleInputBar);

    // 设置按钮先占位，仅做按压反馈
    if (els.settingsBtn) {
      els.settingsBtn.addEventListener('click', function () {
        els.settingsBtn.classList.add('is-active');
        setTimeout(function () { els.settingsBtn.classList.remove('is-active'); }, 220);
      });
    }

    if (els.input) {
      els.input.addEventListener('blur', function () {
        setTimeout(closeInputBar, 120);
      });
      els.input.addEventListener('keydown', function (evt) {
        if (evt.key === 'Enter') {
          evt.preventDefault();
          els.sendBtn.click();
        }
      });
    }

    if (els.sendBtn) {
      els.sendBtn.addEventListener('click', function () {
        var val = (els.input && els.input.value || '').trim();
        if (!val) return;
        appendLine('speech', val, 'out');
        els.input.value = '';
      });
    }

    // AI 模拟回复：点击后先显示"对方正在输入"提示（真实感停顿），
    // 短暂延迟后替换为一条旁白 + 对话组合，模拟一次完整的 AI 回复。
    // 真实场景应把 SIMULATED_AI_LINES 的随机选取替换为实际生成
    // 接口的返回内容。
    var SIMULATED_AI_LINES = [
      { narration: '她微微歪头，像是认真想了想。', speech: '嗯……这个问题我还真没想过，你呢？' },
      { narration: '窗外的光线暗了一些，她把手机换到另一只手。', speech: '刚刚在忙一点别的事，没来得及回你。' },
      { narration: '她笑了一下，语气放松下来。', speech: '没什么特别的，就是想听听你的声音。' },
      { narration: '她顿了顿，似乎在斟酌措辞。', speech: '说实话，我也说不太清楚，但感觉挺好的。' }
    ];
    var aiReplyTimer = null;
    if (els.aiBtn) {
      els.aiBtn.addEventListener('click', function () {
        els.aiBtn.classList.add('is-active');
        setTimeout(function () { els.aiBtn.classList.remove('is-active'); }, 220);

        if (aiReplyTimer) clearTimeout(aiReplyTimer);
        showTyping('in');
        var pick = SIMULATED_AI_LINES[Math.floor(Math.random() * SIMULATED_AI_LINES.length)];
        aiReplyTimer = setTimeout(function () {
          hideTyping();
          if (pick.narration) appendLine('narration', pick.narration);
          appendLine('speech', pick.speech, 'in');
        }, 1400);
      });
    }

    // 对外暴露的追加接口，供后续脚本推送旁白/说话内容
    window.__crmAppendCallLine = appendLine;
    // 对外暴露的输入中提示接口：showTyping('in'|'out') 显示，
    // hideTyping() 清除；appendLine 不会自动清掉它，需调用方自行
    // 在收到真正内容前调用 hideTyping()，或直接调用 showTyping
    // 覆盖（同一时刻只保留一条，不会重复堆叠）
    window.__crmShowTypingIndicator = showTyping;
    window.__crmHideTypingIndicator = hideTyping;

    // 包装原有的呼叫入口：呼叫中 → 模拟停顿 → 接通页
    var originalOpenCall = window.__crmOpenCallPage;
    if (typeof originalOpenCall === 'function' && !originalOpenCall.__ccv3Wrapped) {
      var wrapped = function () {
        originalOpenCall.apply(this, arguments);
        if (ringTimer) clearTimeout(ringTimer);
        ringTimer = setTimeout(function () {
          if (window.__crmCloseCallPage) window.__crmCloseCallPage();
          open();
        }, SIMULATED_RING_MS);
      };
      wrapped.__ccv3Wrapped = true;
      window.__crmOpenCallPage = wrapped;
    }

    window.__crmOpenConnectedPage = open;
    window.__crmCloseConnectedPage = close;
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