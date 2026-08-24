/* ==========================================================================
   Chatroom — chatroom.js
   聊天室页面交互逻辑：
   - 入口守卫：仅接受由好友详情页写入的会话令牌（sessionStorage），
     直接以 URL 打开本页时展示拦截层，不渲染任何聊天内容
   - 状态栏时间/电量：与 chat.js 主状态栏读取同一份 localStorage，保持同步
   - 消息数据持久化在 LunaDB（与 chat.js 共用同一个 IndexedDB 数据库），
     以对方 charId/好友名 作为会话 key，前后台切换/刷新后消息不丢失
   - 气泡渲染：居中完整日期徽记 + 左右气泡 + AM/PM 时间戳
   - 输入栏：左功能加号（面板占位）· 中输入框 · 右 AI 建议 + 发送
========================================================================== */
(function () {
  'use strict';

  var SESSION_KEY = 'luna_chat_session';

  /* ---- 与 friend-profile.js 一致的色阶表，用于无头像时的字母占位底色 ---- */
  var COLOR_MAP = {
    ink:    { avBg:'#101012', avCol:'#c9c9cd' },
    slate:  { avBg:'#141416', avCol:'#b8bac0' },
    silver: { avBg:'#1a1a1c', avCol:'#d4d4d8' },
    frost:  { avBg:'#111316', avCol:'#c8ccd0' },
    smoke:  { avBg:'#0e0e10', avCol:'#bdbdc2' },
    pearl:  { avBg:'#1c1c1e', avCol:'#e0e0e3' }
  };

  var AI_CONTEXT_LIMIT = 24; // 送入 AI 的最近上下文条数上限，避免 prompt 过长

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
      backBtn: document.getElementById('crmBackBtn'),
      moreBtn: document.getElementById('crmMoreBtn'),
      bgLayer: document.getElementById('crmBgLayer'),
      bgImg: document.getElementById('crmBgImg'),
      bgVideo: document.getElementById('crmBgVideo'),
      bgScrim: document.getElementById('crmBgScrim'),
      peerAvatar: document.getElementById('crmPeerAvatar'),
      peerAvatarGlyph: document.getElementById('crmPeerAvatarGlyph'),
      peerBadge: document.getElementById('crmPeerBadge'),
      peerName: document.getElementById('crmPeerName'),
      peerNameRow: document.getElementById('crmPeerNameRow'),
      peerStatus: document.getElementById('crmPeerStatus'),
      scroll: document.getElementById('crmScroll'),
      scrollInner: document.getElementById('crmScrollInner'),
      emptyHint: document.getElementById('crmEmptyHint'),
      inputBar: document.getElementById('crmInputBar'),
      panel: document.getElementById('crmPanel'),
      panelVeil: document.getElementById('crmPanelVeil'),
      panelDismiss: document.getElementById('crmPanelDismiss'),
      fanViewport: document.getElementById('crmFanViewport'),
      fanTrack: document.getElementById('crmFanTrack'),
      fnBtn: document.getElementById('crmFnBtn'),
      textarea: document.getElementById('crmTextarea'),
      aiBtn: document.getElementById('crmAiBtn'),
      sendBtn: document.getElementById('crmSendBtn')
    };

    var myAvatarUrl = null;
    var myName = '我';
    var aiSuggestEl = null;
    var msgGroupSeq = 0; // 用于给每个头像的 SVG mask 生成唯一 id

    applyPeerHeader(session, els);
    loadIdentity().then(function (identity) {
      if (identity) { myAvatarUrl = identity.avatar || null; myName = identity.name || '我'; }
    });

    var storeKey = 'chatroom:' + (session.charId != null ? ('char-' + session.charId) : ('name-' + session.name));

    loadMessages(storeKey).then(function (list) {
      renderAll(list, els, session);
      scrollToBottom(els, false);
    });

    /* ---- 聊天背景：与 chatsetting.js 共用同一套 key 约定——
       优先读取「仅此角色」专属背景，未设置则退化读取全局背景，
       都没有则保持默认月光纸面（不渲染任何背景层内容）。
       保存后通过 BroadcastChannel / localStorage ping 实时同步，
       无需刷新页面。 ---- */
    var bgCharKey = 'bgSetting:' + (session.charId != null ? ('char-' + session.charId) : ('name-' + session.name));
    var bgGlobalKey = 'bgSetting:global';

    function bgDbGet(key) {
      if (window.LunaDB) return window.LunaDB.get(key).then(function (v) { return v || null; });
      return Promise.resolve(null);
    }

    function applyBackground(cfg) {
      if (!els.bgLayer) return;
      var hasMedia = cfg && cfg.src && (cfg.type === 'image' || cfg.type === 'video');
      if (!hasMedia) {
        els.bgImg.hidden = true;
        els.bgVideo.hidden = true;
        els.bgVideo.pause && els.bgVideo.pause();
        els.bgScrim.style.background = 'transparent';
        return;
      }
      var fitClass = cfg.fit === 'contain' ? 'is-contain' : '';
      if (cfg.type === 'image') {
        els.bgVideo.hidden = true;
        els.bgVideo.pause && els.bgVideo.pause();
        els.bgImg.src = cfg.src;
        els.bgImg.className = 'crm-bg-media' + (fitClass ? ' ' + fitClass : '');
        els.bgImg.hidden = false;
      } else {
        els.bgImg.hidden = true;
        if (els.bgVideo.getAttribute('src') !== cfg.src) els.bgVideo.setAttribute('src', cfg.src);
        els.bgVideo.className = 'crm-bg-media' + (fitClass ? ' ' + fitClass : '');
        els.bgVideo.hidden = false;
        var p = els.bgVideo.play();
        if (p && p.catch) p.catch(function () {});
      }
      var dim = (typeof cfg.dim === 'number' ? cfg.dim : 30) / 100;
      els.bgScrim.style.background = 'rgba(10,10,12,' + dim.toFixed(2) + ')';
    }

    function loadAndApplyBackground() {
      bgDbGet(bgCharKey).then(function (charCfg) {
        if (charCfg && charCfg.type && charCfg.type !== 'none' && charCfg.src) {
          applyBackground(charCfg);
          return;
        }
        return bgDbGet(bgGlobalKey).then(function (globalCfg) {
          applyBackground(globalCfg);
        });
      }).catch(function () { applyBackground(null); });
    }
    loadAndApplyBackground();

    /* ---- 实时同步：聊天设置页保存后广播的两条通道都监听，
       只要 key 命中当前会话相关的两个 key（专属 / 全局）之一，
       立即重新加载并应用，不需要用户手动刷新 ---- */
    try {
      if ('BroadcastChannel' in window) {
        var bgChannel = new BroadcastChannel('luna_bg_channel');
        bgChannel.onmessage = function (evt) {
          var key = evt && evt.data && evt.data.key;
          if (key === bgCharKey || key === bgGlobalKey) loadAndApplyBackground();
        };
      }
    } catch (e) {}
    window.addEventListener('storage', function (evt) {
      if (evt.key !== 'luna_bg_ping') return;
      try {
        var payload = JSON.parse(evt.newValue || '{}');
        if (payload.key === bgCharKey || payload.key === bgGlobalKey) loadAndApplyBackground();
      } catch (e) { loadAndApplyBackground(); }
    });
    window.addEventListener('pageshow', loadAndApplyBackground);
    window.addEventListener('focus', loadAndApplyBackground);

    /* ---- 状态栏时间/电量：与主状态栏同源 ---- */
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

    /* ---- 返回：优先回退历史记录，无历史则回好友列表页 ---- */
    if (els.backBtn) {
      els.backBtn.addEventListener('click', function () {
        if (window.history.length > 1) window.history.back();
        else window.location.href = 'chat.html';
      });
    }

    /* ---- 顶栏最右侧按钮：跳转至聊天设置页（chatsetting.html），
       会话令牌沿用同一份 sessionStorage，无需额外传参 ---- */
    if (els.moreBtn) {
      els.moreBtn.addEventListener('click', function () {
        els.moreBtn.classList.add('fp-tap-flash');
        setTimeout(function () {
          els.moreBtn.classList.remove('fp-tap-flash');
          window.location.href = 'chatsetting.html';
        }, 140);
      });
    }

    /* ---- 功能加号：唤出/收起「十三簿」全局虚化扇形卡阵 ---- */
    initFanPanel(els);
    if (els.fnBtn) {
      els.fnBtn.addEventListener('click', function () {
        if (els.panel.classList.contains('is-open')) { closeFanPanel(els); return; }
        closeAiSuggest();
        openFanPanel(els);
      });
    }
    if (els.panelVeil) els.panelVeil.addEventListener('click', function () { closeFanPanel(els); });
    if (els.panelDismiss) els.panelDismiss.addEventListener('click', function () { closeFanPanel(els); });

    /* ---- 输入框：自适应高度 + 发送按钮可用态 ---- */
    if (els.textarea) {
      els.textarea.addEventListener('input', function () {
        els.textarea.style.height = 'auto';
        els.textarea.style.height = Math.min(els.textarea.scrollHeight, 112) + 'px';
        var hasText = els.textarea.value.trim().length > 0;
        els.sendBtn.disabled = !hasText;
      });
      els.textarea.addEventListener('focus', function () {
        closeFanPanel(els);
        closeAiSuggest();
        setTimeout(function () { scrollToBottom(els, true); }, 260);
      });
      els.textarea.addEventListener('keydown', function (evt) {
        if (evt.key === 'Enter' && !evt.shiftKey) {
          evt.preventDefault();
          sendMessage();
        }
      });
    }

    if (els.sendBtn) {
      els.sendBtn.addEventListener('click', sendMessage);
    }

    /* ---- AI 回复按钮：仅在用户点击时触发一次真实生成 ----
       严格顺序：读取角色人设 → 读取绑定世界书（常驻 + 关键词命中）→
       读取绑定的 user 人设 → 结合最近上下文 → 调用已配置的 AI 接口 →
       把回复拆成多条短句依次入库并渲染。全程只在点击后触发一次，
       生成中再次点击视为“取消”，不会有任何后台自动触发。 ---- */
    var aiGenerating = false;
    var aiAbort = false;

    if (els.aiBtn) {
      els.aiBtn.addEventListener('click', function () {
        if (aiGenerating) { aiAbort = true; finishAiThinking(); return; }
        closeFanPanel(els);
        closeAiSuggest();
        runAiReply();
      });
    }

    function startAiThinking() {
      aiGenerating = true;
      aiAbort = false;
      els.aiBtn.classList.add('is-thinking');
      els.aiBtn.setAttribute('aria-label', '停止生成');
    }
    function finishAiThinking() {
      aiGenerating = false;
      els.aiBtn.classList.remove('is-thinking');
      els.aiBtn.setAttribute('aria-label', 'AI 回复建议');
    }

    async function runAiReply() {
      if (aiGenerating) return;
      startAiThinking();

      try {
        var history = await loadMessages(storeKey);

        var apiCfg = readApiConfig();
        if (!apiCfg) {
          finishAiThinking();
          showAiToast('还没有配置 AI 接口，请先在设置里填写并选择模型');
          return;
        }

        // ---- 最高指令：角色人设 / 世界书 / user 人设，三者必须精准读取 ----
        var charRecord   = await loadCharacterRecord(session);
        var worldSection  = await buildWorldbookSection(charRecord, history);
        var userIdentity  = await loadBoundUserIdentity(charRecord);

        var systemPrompt = buildSystemPrompt(charRecord, session, worldSection, userIdentity, myName);
        var chatMessages  = buildChatMessages(systemPrompt, history, myName);

        if (aiAbort) { finishAiThinking(); return; }

        var replyText = await callAiApi(apiCfg, chatMessages);
        if (aiAbort) { finishAiThinking(); return; }
        if (!replyText) {
          finishAiThinking();
          showAiToast('AI 没有返回内容，请稍后再试');
          return;
        }

        var segments = splitIntoOddSegments(replyText);
        await appendAiSegments(segments);
      } catch (err) {
        showAiToast('生成失败：' + (err && err.message ? err.message : '请检查网络与接口配置'));
      } finally {
        finishAiThinking();
      }
    }

    /* ---- 依次把拆好的多条短句作为角色的多条消息写入并渲染，
       条与条之间加一点错落的停顿，模拟真人连续发送的节奏 ---- */
    async function appendAiSegments(segments) {
      for (var i = 0; i < segments.length; i++) {
        if (aiAbort) return;
        var seg = segments[i];
        if (!seg) continue;
        var msg = { from: 'peer', text: seg, ts: Date.now() };
        var list = await loadMessages(storeKey);
        list.push(msg);
        await saveMessages(storeKey, list);
        renderAll(list, els, session);
        scrollToBottom(els, true);
        if (window.LunaMessagesBus) window.LunaMessagesBus.notify();
        if (i < segments.length - 1) {
          await wait(320 + Math.random() * 520);
        }
      }
    }

    function wait(ms) {
      return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    function showAiToast(text) {
      var toast = document.createElement('div');
      toast.className = 'crm-ai-suggest';
      toast.style.cssText = 'padding:10px 14px;font-size:12.5px;color:var(--crm-moon-line,#8a8a92);';
      toast.textContent = text;
      els.inputBar.insertBefore(toast, els.inputBar.querySelector('.crm-input-row'));
      requestAnimationFrame(function () { toast.classList.add('is-open'); });
      setTimeout(function () {
        toast.classList.remove('is-open');
        setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 320);
      }, 2600);
    }

    function closeAiSuggest() {
      if (!aiSuggestEl) return;
      var el = aiSuggestEl;
      aiSuggestEl = null;
      el.classList.remove('is-open');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
    }

    function sendMessage() {
      var text = els.textarea.value.trim();
      if (!text) return;
      var msg = { from: 'me', text: text, ts: Date.now() };
      els.textarea.value = '';
      els.textarea.style.height = 'auto';
      els.sendBtn.disabled = true;
      closeAiSuggest();

      loadMessages(storeKey).then(function (list) {
        list.push(msg);
        return saveMessages(storeKey, list).then(function () { return list; });
      }).then(function (list) {
        renderAll(list, els, session);
        scrollToBottom(els, true);
        // 通知消息列表页（chat.html）刷新该会话的最新预览/未读状态，
        // 与 chat.js 中 window.LunaMessagesBus 约定的广播机制对接
        if (window.LunaMessagesBus) window.LunaMessagesBus.notify();
      });
    }

    function applyPeerHeader(session, els) {
      els.peerName.textContent = session.name || '好友';
      els.peerNameRow.classList.toggle('is-online', !!session.online);
      els.peerBadge.classList.toggle('is-online', !!session.online);
      els.peerStatus.classList.toggle('is-online', !!session.online);
      els.peerStatus.textContent = session.online ? '在线 · ONLINE' : '离线 · OFFLINE';

      var colorKey = session.color || 'ink';
      var col = COLOR_MAP[colorKey] || COLOR_MAP.ink;
      var avatarUrl = session.avatar;
      if (avatarUrl) {
        els.peerAvatar.style.background = 'none';
        els.peerAvatarGlyph.style.display = 'none';
        var img = document.createElement('img');
        img.src = avatarUrl;
        img.alt = '';
        els.peerAvatar.insertBefore(img, els.peerAvatar.firstChild);
      } else {
        els.peerAvatar.style.background = col.avBg;
        els.peerAvatarGlyph.style.color = col.avCol;
        els.peerAvatarGlyph.textContent = (session.name || '?').charAt(0);
      }
    }

    function renderAll(list, els, session) {
      var inner = els.scrollInner;
      inner.querySelectorAll('.crm-date-seal-row, .crm-msg-group, .crm-sys-row').forEach(function (n) { n.remove(); });

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
          inner.appendChild(buildDateSeal(d));
          lastDateKey = dateKey;
        }
        /* ---- 连续同发送方的消息归并为一个「气泡串」组，
           组内共享同一条纵向渐变，让渐变感贯穿多条消息，
           而非每条气泡各自独立渐变 ---- */
        var group = [msg];
        var j = i + 1;
        while (j < list.length && list[j].from === msg.from) {
          var dj = new Date(list[j].ts);
          var dayKeyJ = dj.getFullYear() + '-' + dj.getMonth() + '-' + dj.getDate();
          if (dayKeyJ !== dateKey) break;
          group.push(list[j]);
          j++;
        }
        inner.appendChild(buildMsgGroup(group, session));
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
      /* 月环徽记：细描边底环 + 右下角一枚够大的新月徽章，
         新月徽章本身兼任在线状态标记，不再额外画一个圆点——
         避免"环上一个小月牙 + 角落另一个小圆点"两个小元素
         挤在一起反而都看不清的问题。
         徽章直径这次占 viewBox 的约 1/3（不是上次过小的 14/48
         比例的一半再叠小圆点），先铺一个底盘圆（plate）垫底，
         再叠新月，保证在任何头像底色上都有清晰的白/深色衬底 */
      var moonMaskId = 'crmMoonMask' + (msgGroupSeq++);
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

      /* ---- 气泡串容器：内部气泡各自按位置截取同一幅贯穿渐变
         长图（见下方 requestAnimationFrame 对位逻辑），拼起来读出
         一条渐变贯穿整串消息的效果 ---- */
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

        bubble.addEventListener('click', function (evt) {
          evt.stopPropagation();
          openSelectMenu(bubble, msg, isMe);
        });

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

      /* ---- 贯穿渐变对位：整条串渲染完成后，测量真实高度，
         把渐变长图的总高度、以及每条气泡相对串顶部的像素偏移
         写成 CSS 变量，让相邻气泡截取的渐变恰好首尾相接。
         —— 关键修正：之前的写法用固定参考高度 REF_H，并把它
         按"气泡条数"均分取色带宽——这在每条气泡高度差不多时
         没问题，但一旦串里出现一条很长的消息（真实像素高度
         远超平均带宽），CSS 侧的 background-size 却仍然把同一张
         渐变图统一拉伸成 --crm-stream-h（=REF_H）那么高，导致
         这条又高又窄的取色带被强行拉伸铺满整条长气泡，色带被
         拉断、拼接处露出生硬的色阶断层（就是长消息气泡上出现
         横纹色块的原因）。
         现在改为：--crm-stream-h 直接使用整串的真实总像素高度
         streamH（渐变图与真实像素 1:1 对应，不再有额外拉伸），
         每条气泡的取色偏移 --crm-stream-y 也改成它在串内的真实
         累计像素偏移（用 offsetTop 差值计算，而不是"平均带宽 ×
         序号"），这样不论某条气泡多高多矮，拿到的都是渐变图上
         与它自身像素高度完全匹配的一段，相邻气泡首尾自然相接，
         不会再出现断层 ---- */
      requestAnimationFrame(function () {
        var streamH = stream.offsetHeight;
        if (!streamH) return;
        /* 单条/短串气泡真实高度可能只有 40~60px，如果渐变图也
           跟着压缩到这么矮，色阶间距会被压得看不出层次；这里给
           一个下限，短串仍按较大的参考高度取色（渐变更舒展），
           长串则按真实高度 1:1 对应（避免拉伸断层） */
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

  }

  /* ==========================================================================
     附加功能面板 —— 「十三簿」全局虚化扇形卡阵
     十三张占位功能卡：重回 / 图片 / 表情包 / 语音 / 视频 / 位置 /
     转账 / 红包 / 心声 / 线下 / 小剧场 / 礼物 / 私密。
     全部为纯占位交互（点击后仅收起面板），具体业务逻辑留待接入，
     这里只负责扇形横滑的视觉呈现与手势联动 ---- */
  var FAN_FOLIOS = [
    { key:'rewind',  label:'重回', sub:'REWIND',  icon: fanIconRewind() },
    { key:'photo',   label:'图片', sub:'PHOTO',   icon: fanIconPhoto() },
    { key:'sticker', label:'表情包', sub:'STICKER', icon: fanIconSticker() },
    { key:'voice',   label:'语音', sub:'VOICE',   icon: fanIconVoice() },
    { key:'video',   label:'视频', sub:'VIDEO',   icon: fanIconVideo() },
    { key:'location',label:'位置', sub:'LOCATION',icon: fanIconLocation() },
    { key:'transfer',label:'转账', sub:'TRANSFER',icon: fanIconTransfer() },
    { key:'redpack', label:'红包', sub:'GIFT SUM',icon: fanIconRedpack() },
    { key:'voicemind',label:'心声', sub:'INNER VOICE', icon: fanIconHeart() },
    { key:'offline', label:'线下', sub:'IN PERSON', icon: fanIconOffline() },
    { key:'theatre', label:'小剧场', sub:'VIGNETTE', icon: fanIconTheatre() },
    { key:'gift',    label:'礼物', sub:'PRESENT',  icon: fanIconGift() },
    { key:'private', label:'私密', sub:'PRIVATE',  icon: fanIconPrivate(), lacquer:true }
  ];

  var fanBuilt = false;
  var fanRafId = null;

  function initFanPanel(els) {
    if (!els.fanTrack || fanBuilt) return;
    fanBuilt = true;

    FAN_FOLIOS.forEach(function (folio) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'crm-fan-card' + (folio.lacquer ? ' is-lacquer' : '');
      card.setAttribute('data-folio', folio.key);

      /* 牌面内嵌留白框：细描边 + 四角錾刻直角托，把牌铭/图形从\n
         卡片外沿"框"出独立一层，做出牙牌的纵深，而非贴壁摆放 */
      var frame = document.createElement('span');
      frame.className = 'crm-fan-card-frame';

      var cornerA = document.createElement('span');
      cornerA.className = 'crm-fan-corner-a';
      var cornerB = document.createElement('span');
      cornerB.className = 'crm-fan-corner-b';

      var plate = document.createElement('span');
      plate.className = 'crm-fan-icon-plate';
      plate.innerHTML = folio.icon;

      var labelBlock = document.createElement('span');
      labelBlock.className = 'crm-fan-label-block';

      var label = document.createElement('span');
      label.className = 'crm-fan-label';
      label.textContent = folio.label;

      var divider = document.createElement('span');
      divider.className = 'crm-fan-divider';

      var sub = document.createElement('span');
      sub.className = 'crm-fan-sub';
      sub.textContent = folio.sub;

      labelBlock.appendChild(label);
      labelBlock.appendChild(divider);
      labelBlock.appendChild(sub);

      frame.appendChild(cornerA);
      frame.appendChild(cornerB);
      frame.appendChild(plate);
      frame.appendChild(labelBlock);
      card.appendChild(frame);

      card.addEventListener('click', function () {
        /* 占位：具体业务逻辑后续接入，这里先居中该卡并统一收起面板 */
        closeFanPanel(els);
      });

      els.fanTrack.appendChild(card);
    });

    els.fanViewport.addEventListener('scroll', function () {
      scheduleFanLayout(els);
    }, { passive: true });
    window.addEventListener('resize', function () {
      if (els.panel.classList.contains('is-open')) scheduleFanLayout(els);
    });
  }

  /* 扇形布局核心：以视口中心为锚点，按每张卡自身中心与锚点的\n
     像素距离，映射出旋转角、纵向偏移、缩放与透明度——距锚点越远\n
     的卡，旋转角越大、下沉越多、越小越淡，读出「一叠印鉴牌向两\n
     侧自然摊开」的弧度，而非平铺的横向列表 */
  function scheduleFanLayout(els) {
    if (fanRafId) return;
    fanRafId = requestAnimationFrame(function () {
      fanRafId = null;
      layoutFanCards(els);
    });
  }
  function layoutFanCards(els) {
    var viewport = els.fanViewport;
    var cards = els.fanTrack.querySelectorAll('.crm-fan-card');
    if (!cards.length) return;
    var vpRect = viewport.getBoundingClientRect();
    var centerX = vpRect.left + vpRect.width / 2;
    var maxDist = vpRect.width / 2 + 70;

    cards.forEach(function (card) {
      var r = card.getBoundingClientRect();
      var cardCenter = r.left + r.width / 2;
      var dist = cardCenter - centerX;
      var norm = Math.max(-1, Math.min(1, dist / maxDist));

      var rot = norm * 26;                 // 最大 ±26° 扇形张角，肉眼可辨的摊牌弧度
      var y = Math.abs(norm) * 34;         // 越靠外越下沉，弧形托底更明显
      var scale = 1 - Math.abs(norm) * 0.2;
      var op = 1 - Math.abs(norm) * 0.4;

      card.style.setProperty('--fan-rot', rot.toFixed(2) + 'deg');
      card.style.setProperty('--fan-y', y.toFixed(1) + 'px');
      card.style.setProperty('--fan-scale', scale.toFixed(3));
      card.style.setProperty('--fan-op', Math.max(0.34, op).toFixed(3));
    });
  }

  function openFanPanel(els) {
    els.panel.classList.add('is-open');
    els.panelVeil.classList.add('is-open');
    els.fnBtn.classList.add('is-active');
    els.panel.setAttribute('aria-hidden', 'false');
    els.panelVeil.setAttribute('aria-hidden', 'false');
    document.addEventListener('keydown', onFanPanelKeydown);
    requestAnimationFrame(function () {
      /* 首次展开：视口滚动至最左侧卡居中于锚点，随后按当前滚动\n
         位置计算扇形——避免第一帧所有卡都挤在左端未展开 */
      if (els.fanViewport.scrollLeft === 0) {
        var first = els.fanTrack.querySelector('.crm-fan-card');
        if (first) {
          var target = first.offsetLeft + first.offsetWidth / 2 - els.fanViewport.clientWidth / 2;
          els.fanViewport.scrollLeft = Math.max(0, target);
        }
      }
      layoutFanCards(els);
    });
  }
  function closeFanPanel(els) {
    if (!els.panel.classList.contains('is-open')) return;
    els.panel.classList.remove('is-open');
    els.panelVeil.classList.remove('is-open');
    els.fnBtn.classList.remove('is-active');
    els.panel.setAttribute('aria-hidden', 'true');
    els.panelVeil.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', onFanPanelKeydown);
  }
  function onFanPanelKeydown(evt) {
    if (evt.key === 'Escape') {
      var els = { panel: document.getElementById('crmPanel'), panelVeil: document.getElementById('crmPanelVeil'), fnBtn: document.getElementById('crmFnBtn') };
      closeFanPanel(els);
    }
  }

  /* 十三簿线性描边图形印记：每枚图形取材于该功能自身的实物/意象\n
     （非通用符号堆砌），统一 1.4~1.5px 描边、圆头圆角，\n
     与顶栏/输入栏/长按菜单的其余 SVG 同一套笔触，禁止 emoji ---- */
  function fanIconRewind(){
    return '<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M12 5V2L7.5 5.5L12 9V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 6C16.4183 6 20 9.13401 20 13C20 16.866 16.4183 20 12 20C7.58172 20 4 16.866 4 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  }
  function fanIconPhoto(){
    return '<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="14" rx="2.3" stroke="currentColor" stroke-width="1.4"/><circle cx="8.3" cy="9.6" r="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M4.5 16.8L9 12.2L12.2 15L16.3 10.4L19.6 15" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function fanIconSticker(){
    return '<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M4 8.5C4 6 6 4 8.5 4H15C17.5 4 19.5 6 19.5 8.5V13C19.5 13 19.5 16.5 16 16.5C13.4 16.5 13.5 16.5 13.5 16.5C13.5 16.5 13.7 20 10 20H8.5C6 20 4 18 4 15.5V8.5Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M13.5 16.5C13.5 16.5 19.4 16.5 19.5 13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.7" cy="9.3" r="1" fill="currentColor"/><circle cx="14.3" cy="9.3" r="1" fill="currentColor"/></svg>';
  }
  function fanIconVoice(){
    return '<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><rect x="9.3" y="3.5" width="5.4" height="10" rx="2.7" stroke="currentColor" stroke-width="1.4"/><path d="M6 11.5C6 14.8 8.7 17.5 12 17.5C15.3 17.5 18 14.8 18 11.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M12 17.5V20.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  }
  function fanIconVideo(){
    return '<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="6.5" width="12" height="11" rx="2.3" stroke="currentColor" stroke-width="1.4"/><path d="M15.5 10.8L20 8V16L15.5 13.2" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  }
  function fanIconLocation(){
    return '<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M12 21C12 21 18.5 14.9 18.5 10.2C18.5 6.5 15.6 3.5 12 3.5C8.4 3.5 5.5 6.5 5.5 10.2C5.5 14.9 12 21 12 21Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="12" cy="10.2" r="2.2" stroke="currentColor" stroke-width="1.3"/></svg>';
  }
  function fanIconTransfer(){
    return '<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M4 8H16.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M13.5 4.5L17 8L13.5 11.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 16H7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M10.5 12.5L7 16L10.5 19.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function fanIconRedpack(){
    return '<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><rect x="4.5" y="5" width="15" height="15.5" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M4.5 10H19.5" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="10" r="2.6" stroke="currentColor" stroke-width="1.3"/><path d="M9 5L12 8.2L15 5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';
  }
  function fanIconHeart(){
    return '<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M12 20C12 20 4.5 15.4 4.5 9.9C4.5 7.1 6.7 5 9.3 5C10.5 5 11.6 5.6 12 6.6C12.4 5.6 13.5 5 14.7 5C17.3 5 19.5 7.1 19.5 9.9C19.5 15.4 12 20 12 20Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M9 11.2L11 13L15 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function fanIconOffline(){
    return '<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M6 20V9L12 4.5L18 9V20" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M9.8 20V14.5H14.2V20" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  }
  function fanIconTheatre(){
    return '<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M4.5 5H19.5V13C19.5 16.6 16.6 19.5 13 19.5H11C7.4 19.5 4.5 16.6 4.5 13V5Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M4.5 8.5H19.5" stroke="currentColor" stroke-width="1.3"/><path d="M9 5V3.5M15 5V3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
  }
  function fanIconGift(){
    return '<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><rect x="4" y="9.5" width="16" height="10" rx="1.6" stroke="currentColor" stroke-width="1.4"/><path d="M4 13H20" stroke="currentColor" stroke-width="1.3"/><path d="M12 9.5V19.5" stroke="currentColor" stroke-width="1.3"/><path d="M12 9.5C12 9.5 8.5 9.5 8 7.3C7.7 6 8.8 4.7 10.2 4.7C11.6 4.7 12 6.6 12 9.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M12 9.5C12 9.5 15.5 9.5 16 7.3C16.3 6 15.2 4.7 13.8 4.7C12.4 4.7 12 6.6 12 9.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';
  }
  function fanIconPrivate(){
    return '<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><rect x="5.5" y="10.5" width="13" height="9" rx="2.2" stroke="currentColor" stroke-width="1.4"/><path d="M8 10.5V7.8C8 5.7 9.8 4 12 4C14.2 4 16 5.7 16 7.8V10.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="12" cy="14.6" r="1.3" fill="currentColor"/></svg>';
  }

  /* ==========================================================================
     气泡长按操作面板 —— iOS 风格上下文菜单
     点击气泡：背景整体虚化压暗，被点击的气泡"浮"出到最上层保持
     原位不变，气泡旁弹出一枚磨砂白玉操作面板。
     功能全部占位（复制/引用/收藏/修改/转发/多选/撤回/删除），
     具体业务逻辑留待接入，这里只负责交互与视觉呈现 ---- */
  var selectState = null; // { mask, clone, menu, sourceBubble }

  function ensureSelectLayer() {
    var mask = document.getElementById('crmSelectMask');
    if (mask) return mask;
    mask = document.createElement('div');
    mask.className = 'crm-select-mask';
    mask.id = 'crmSelectMask';
    mask.addEventListener('click', closeSelectMenu);
    document.body.appendChild(mask);
    return mask;
  }

  var SELECT_MENU_ACTIONS = [
    [
      { key: 'copy',    label: '复制', icon: iconCopy() },
      { key: 'quote',   label: '引用', icon: iconQuote() },
      { key: 'star',    label: '收藏', icon: iconStar() },
      { key: 'edit',    label: '修改', icon: iconEdit() },
      { key: 'forward', label: '转发', icon: iconForward() },
      { key: 'multi',   label: '多选', icon: iconMulti() }
    ],
    [
      { key: 'recall', label: '撤回', icon: iconRecall(), danger: true },
      { key: 'delete', label: '删除', icon: iconDelete(), danger: true }
    ]
  ];

  function openSelectMenu(bubbleEl, msg, isMe) {
    closeSelectMenu(true);

    var mask = ensureSelectLayer();
    var rect = bubbleEl.getBoundingClientRect();

    /* 克隆气泡：复制一份原气泡的完整 DOM（含贯穿渐变的内联变量），
       定位到原气泡的屏幕坐标上，脱离虚化层单独置顶——视觉上就是
       "这一条气泡自己浮起来了"，而不是另画一个假气泡 */
    var cloneWrap = document.createElement('div');
    cloneWrap.className = 'crm-select-clone' + (isMe ? ' is-me' : '');
    var cloneBubble = bubbleEl.cloneNode(true);
    cloneWrap.appendChild(cloneBubble);
    cloneWrap.style.left = rect.left + 'px';
    cloneWrap.style.top = rect.top + 'px';
    cloneWrap.style.width = rect.width + 'px';
    document.body.appendChild(cloneWrap);

    var menu = document.createElement('div');
    menu.className = 'crm-select-menu';
    SELECT_MENU_ACTIONS.forEach(function (group, gi) {
      var groupEl = document.createElement('div');
      groupEl.className = 'crm-select-menu-group';
      group.forEach(function (item) {
        var row = document.createElement('button');
        row.type = 'button';
        row.className = 'crm-select-menu-row' + (item.danger ? ' is-danger' : '');
        row.innerHTML =
          '<span class="crm-select-menu-label">' + item.label + '</span>' +
          '<span class="crm-select-menu-icon" aria-hidden="true">' + item.icon + '</span>';
        row.addEventListener('click', function () {
          /* 占位：具体功能逻辑后续接入，这里先统一收起面板 */
          closeSelectMenu();
        });
        groupEl.appendChild(row);
      });
      menu.appendChild(groupEl);
    });
    document.body.appendChild(menu);

    /* 定位：优先放在气泡上方，间距 10px；若上方空间不够（气泡
       靠近屏幕顶部），改放到气泡下方，menu 的展开动画锚点也
       跟着切换（transform-origin 从顶部改为底部）。
       —— 关键修正：边界不能用 window.innerWidth/innerHeight——
       这是手机壳 mockup，.phone-frame 内部有 transform，会形成
       独立的 fixed 定位包含块，真正可用的可视区域是手机壳自身
       的矩形，而不是整个浏览器窗口（窗口可能比手机壳大得多，
       之前按窗口高度去夹限，菜单实际早就超出手机壳边缘，被
       手机壳的圆角边框裁掉，看起来像"最后一行不见了"）。
       同时要把顶栏、输入栏的真实高度也算进安全区，
       不能让菜单被这两条固定栏挡住或压在它们后面 ---- */
    requestAnimationFrame(function () {
      var frameEl = bubbleEl.closest('.phone-frame') || document.body;
      var frameRect = frameEl.getBoundingClientRect();
      var topBarEl = document.getElementById('crmTopBar');
      var inputBarEl = document.getElementById('crmInputBar');
      var safeTop = frameRect.top + (topBarEl ? topBarEl.getBoundingClientRect().height : 0) + 10;
      var safeBottom = frameRect.bottom - (inputBarEl ? inputBarEl.getBoundingClientRect().height : 0) - 10;

      var menuH = menu.offsetHeight;
      var menuW = menu.offsetWidth;
      var gap = 10;
      var top;
      var below = rect.top - menuH - gap < safeTop;
      if (below) {
        top = Math.min(rect.bottom + gap, safeBottom - menuH);
        menu.classList.add('is-below');
      } else {
        top = rect.top - menuH - gap;
      }
      /* 极端情况：气泡本身很高，上下都放不下完整菜单——退而求其次，
         贴着安全区顶部对齐，并让菜单自身滚动而不是裁切内容 */
      top = Math.max(safeTop, Math.min(top, safeBottom - menuH));
      if (menuH > safeBottom - safeTop) {
        top = safeTop;
        menu.style.maxHeight = (safeBottom - safeTop) + 'px';
        menu.style.overflowY = 'auto';
      }

      var left = rect.left + rect.width / 2 - menuW / 2;
      left = Math.max(frameRect.left + 10, Math.min(left, frameRect.right - menuW - 10));
      menu.style.left = left + 'px';
      menu.style.top = top + 'px';

      mask.classList.add('is-open');
      cloneWrap.classList.add('is-open');
      menu.classList.add('is-open');
    });

    bubbleEl.style.visibility = 'hidden';

    selectState = { mask: mask, clone: cloneWrap, menu: menu, sourceBubble: bubbleEl };

    document.addEventListener('keydown', onSelectKeydown);
    window.addEventListener('scroll', closeSelectMenuFromScroll, true);
    window.addEventListener('resize', closeSelectMenuPlain);
  }

  function closeSelectMenuFromScroll() { closeSelectMenu(); }
  function closeSelectMenuPlain() { closeSelectMenu(); }

  function closeSelectMenu(immediate) {
    if (!selectState) return;
    var st = selectState;
    selectState = null;
    document.removeEventListener('keydown', onSelectKeydown);
    window.removeEventListener('scroll', closeSelectMenuFromScroll, true);
    window.removeEventListener('resize', closeSelectMenuPlain);

    if (st.sourceBubble) st.sourceBubble.style.visibility = '';

    st.mask.classList.remove('is-open');
    st.clone.classList.remove('is-open');
    st.menu.classList.remove('is-open');

    var remove = function () {
      if (st.clone.parentNode) st.clone.parentNode.removeChild(st.clone);
      if (st.menu.parentNode) st.menu.parentNode.removeChild(st.menu);
    };
    if (immediate) { remove(); return; }
    setTimeout(remove, 260);
  }

  function onSelectKeydown(evt) {
    if (evt.key === 'Escape') closeSelectMenu();
  }

  /* 线性描边图标，风格统一 1.5px stroke、圆头圆角，
     与顶栏/输入栏其余 SVG 图标同一套笔触 */
  function iconCopy() {
    return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="8.5" y="8.5" width="11" height="12.5" rx="2.4" stroke="currentColor" stroke-width="1.5"/><path d="M15.5 8.5V6.4C15.5 5.1 14.4 4 13.1 4H6.4C5.1 4 4 5.1 4 6.4V15.1C4 16.4 5.1 17.5 6.4 17.5H8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  }
  function iconQuote() {
    return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M5 15V11.5C5 8.5 6.8 6.4 9.5 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M5 15H9V19H5V15Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M14.5 15V11.5C14.5 8.5 16.3 6.4 19 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M14.5 15H18.5V19H14.5V15Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  }
  function iconStar() {
    return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 4L14.3 9.7L20.5 10.3L15.8 14.3L17.2 20.4L12 17.1L6.8 20.4L8.2 14.3L3.5 10.3L9.7 9.7L12 4Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  }
  function iconEdit() {
    return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M15.7 4.8L19.2 8.3L8.4 19.1L4 20L4.9 15.6L15.7 4.8Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M13.4 7.1L16.9 10.6" stroke="currentColor" stroke-width="1.5"/></svg>';
  }
  function iconForward() {
    return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M13.5 6L19.5 12L13.5 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 17V14C4.5 11.2 6.7 9 9.5 9H19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function iconMulti() {
    return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="9.5" height="9.5" rx="2.2" stroke="currentColor" stroke-width="1.5"/><path d="M9.5 15.5C9.5 17.9853 11.5147 20 14 20C16.4853 20 18.5 17.9853 18.5 15.5C18.5 13.0147 16.4853 11 14 11C11.5147 11 9.5 13.0147 9.5 15.5Z" stroke="currentColor" stroke-width="1.5"/><path d="M6.7 8.7L8.3 10.3L11.3 6.9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function iconRecall() {
    return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M5 10.5H14.5C17 10.5 19 12.5 19 15C19 17.5 17 19.5 14.5 19.5H9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 15L5 10.5L9 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function iconDelete() {
    return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M5 7.5H19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M9.5 7.5V5.6C9.5 4.7 10.2 4 11.1 4H12.9C13.8 4 14.5 4.7 14.5 5.6V7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.5 7.5L8.2 18.4C8.3 19.5 9.2 20.4 10.3 20.4H13.7C14.8 20.4 15.7 19.5 15.8 18.4L16.5 7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function scrollToBottom(els, smooth) {
    requestAnimationFrame(function () {
      els.scroll.scrollTo({ top: els.scroll.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    });
  }

  /* ---- 会话令牌：由 friend-profile.js 在点击"进入聊天"时写入，
     本页仅读取，never 提供其它写入入口 ---- */
  function readSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !data.name) return null;
      return data;
    } catch (e) { return null; }
  }

  /* ---- LunaDB 读写：与 chat.js 共用同一个 IndexedDB(luna_chat_db / kv) ---- */
  function loadMessages(key) {
    if (window.LunaDB) {
      return window.LunaDB.get(key).then(function (v) { return v || []; });
    }
    return Promise.resolve([]);
  }
  function saveMessages(key, list) {
    if (window.LunaDB) return window.LunaDB.set(key, list);
    return Promise.resolve(false);
  }
  function loadIdentity() {
    if (window.LunaDB) return window.LunaDB.get('identity');
    return Promise.resolve(null);
  }

  /* ==========================================================================
     AI 生成引擎：角色人设 / 世界书 / user 人设 三路读取 + 拼装 + 调用
     —— 与 characters.js / worldbook.js / user.js 读写同一份 IndexedDB，
     字段结构完全对齐，不新建、不改写它们的数据 ----------------------------
  ========================================================================== */

  /* ---- LunaCharDB / chars：角色档案（与 characters.js 的 openCharDB 同源） ---- */
  var _aiCharDb = null;
  function openAiCharDb() {
    if (_aiCharDb) return Promise.resolve(_aiCharDb);
    return new Promise(function (resolve, reject) {
      var probe = indexedDB.open('LunaCharDB');
      probe.onsuccess = function (e) {
        var cur = e.target.result;
        var ver = cur.version;
        var hasChars = cur.objectStoreNames.contains('chars');
        cur.close();
        if (hasChars) {
          var req2 = indexedDB.open('LunaCharDB', ver);
          req2.onsuccess = function (e2) { _aiCharDb = e2.target.result; resolve(_aiCharDb); };
          req2.onerror = function (e2) { reject(e2.target.error); };
        } else {
          var req3 = indexedDB.open('LunaCharDB', ver + 1);
          req3.onupgradeneeded = function (e3) {
            var db3 = e3.target.result;
            if (!db3.objectStoreNames.contains('chars')) db3.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
          };
          req3.onsuccess = function (e3) { _aiCharDb = e3.target.result; resolve(_aiCharDb); };
          req3.onerror = function (e3) { reject(e3.target.error); };
        }
      };
      probe.onerror = function (e) { reject(e.target.error); };
      probe.onupgradeneeded = function (e) {
        var db0 = e.target.result;
        if (!db0.objectStoreNames.contains('chars')) db0.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
      };
    });
  }
  function getAllAiChars() {
    return openAiCharDb().catch(function () { return null; }).then(function (db) {
      if (!db || !db.objectStoreNames.contains('chars')) return [];
      return new Promise(function (resolve) {
        var req = db.transaction('chars', 'readonly').objectStore('chars').getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { resolve([]); };
      });
    });
  }

  /* ---- LunaWorldBookDB / entries：世界书条目（与 worldbook.js 同源） ---- */
  var _aiWbDb = null;
  function openAiWbDb() {
    if (_aiWbDb) return Promise.resolve(_aiWbDb);
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open('LunaWorldBookDB', 2);
      req.onupgradeneeded = function (e) {
        if (!e.target.result.objectStoreNames.contains('entries')) {
          e.target.result.createObjectStore('entries', { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = function (e) { _aiWbDb = e.target.result; resolve(_aiWbDb); };
      req.onerror = function () { reject(new Error('WB DB Error')); };
    });
  }
  function getAllAiWbEntries() {
    return openAiWbDb().catch(function () { return null; }).then(function (db) {
      if (!db || !db.objectStoreNames.contains('entries')) return [];
      return new Promise(function (resolve) {
        var req = db.transaction('entries', 'readonly').objectStore('entries').getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { resolve([]); };
      });
    });
  }

  /* ---- LunaIdentityDB / identities：user 人设（与 user.js 同源） ---- */
  var _aiIdDb = null;
  function openAiIdentityDb() {
    if (_aiIdDb) return Promise.resolve(_aiIdDb);
    return new Promise(function (resolve, reject) {
      var probe = indexedDB.open('LunaIdentityDB');
      probe.onsuccess = function (e) {
        var db = e.target.result;
        if (db.objectStoreNames.contains('identities')) { _aiIdDb = db; resolve(_aiIdDb); return; }
        var ver = db.version + 1; db.close();
        var req2 = indexedDB.open('LunaIdentityDB', ver);
        req2.onupgradeneeded = function (ev) {
          if (!ev.target.result.objectStoreNames.contains('identities')) {
            ev.target.result.createObjectStore('identities', { keyPath: 'id' });
          }
        };
        req2.onsuccess = function (ev) { _aiIdDb = ev.target.result; resolve(_aiIdDb); };
        req2.onerror = function (ev) { reject(ev.target.error); };
      };
      probe.onerror = function (e) { reject(e.target.error); };
    });
  }
  function getAllAiIdentities() {
    return openAiIdentityDb().catch(function () { return null; }).then(function (db) {
      if (!db || !db.objectStoreNames.contains('identities')) return [];
      return new Promise(function (resolve) {
        var req = db.transaction('identities', 'readonly').objectStore('identities').getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { resolve([]); };
      });
    });
  }

  /* ---- 读取当前会话对应的角色档案：优先按 session.charId 精确匹配，
     没有 charId（老会话/纯自建好友）则退化按名字匹配，
     都找不到则返回 null —— 调用方必须能处理「没有角色档案」的情况，
     而不是伪造一份人设 ---- */
  function loadCharacterRecord(session) {
    return getAllAiChars().then(function (chars) {
      if (!chars || !chars.length) return null;
      if (session.charId != null) {
        var byId = chars.find(function (c) { return c.id === session.charId || String(c.id) === String(session.charId); });
        if (byId) return byId;
      }
      if (session.name) {
        var byName = chars.find(function (c) { return c.name === session.name; });
        if (byName) return byName;
      }
      return null;
    });
  }

  /* ---- 世界书拼装：常驻条目（mode === 'constant'）全部注入；
     关键词条目（mode === 'keyword'）只在关键词命中最近上下文时注入，
     与 characters.js 里「应用角色」的常驻注入逻辑保持一致的过滤规则
     （enabled !== false 且未关联角色或已关联当前角色），
     额外补上关键词扫描，让触发型条目也能在聊天室里真正生效 ---- */
  function buildWorldbookSection(charRecord, history) {
    var charId = charRecord ? charRecord.id : null;
    return getAllAiWbEntries().then(function (allEntries) {
      if (!allEntries || !allEntries.length) return '';

      var recentText = (history || []).slice(-10).map(function (m) { return m.text || ''; }).join('\n');

      var relevant = allEntries.filter(function (e) {
        if (e.enabled === false) return false;
        var chars = Array.isArray(e.chars) ? e.chars : [];
        var linkedToThis = chars.length === 0 || (charId != null && chars.indexOf(charId) !== -1);
        if (!linkedToThis) return false;
        if (e.mode === 'constant') return true;
        // 关键词触发：keywords / keywordsSec 任一词命中最近上下文才注入
        var kws = ((e.keywords || '') + ',' + (e.keywordsSec || ''))
          .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        if (!kws.length) return false;
        return kws.some(function (kw) { return recentText.indexOf(kw) !== -1; });
      });

      if (!relevant.length) return '';
      relevant.sort(function (a, b) { return (b.priority || 5) - (a.priority || 5); });

      var block = '【世界设定 —— 来自关联世界书，请作为背景真实世界规则严格遵守，不要与之矛盾】\n';
      relevant.forEach(function (e) {
        block += '◆ ' + (e.title || '未命名');
        if (e.sub) block += '（' + e.sub + '）';
        block += '\n' + (e.detail || '') + '\n\n';
      });
      return block.trim();
    });
  }

  /* ---- user 人设：取「当前激活」且绑定了本角色的身份卡；
     若角色没有 id（找不到档案）或没有任何身份绑定它，返回 null——
     绝不能因为缺数据就编造一个 user 人设，宁可让模型知道
     「用户身份未设定」，也不能张冠李戴 ---- */
  function loadBoundUserIdentity(charRecord) {
    var charId = charRecord ? charRecord.id : null;
    if (charId == null) return Promise.resolve(null);
    return getAllAiIdentities().then(function (list) {
      if (!list || !list.length) return null;
      var bound = list.filter(function (idy) {
        if (idy.active === false) return false;
        var ids = Array.isArray(idy.boundCharIds) ? idy.boundCharIds
          : (idy.boundCharId != null ? [idy.boundCharId] : []);
        return ids.indexOf(charId) !== -1;
      });
      if (!bound.length) return null;
      // 多个绑定时优先取主身份，其次取最近创建的
      bound.sort(function (a, b) {
        if (!!a.isPrimary !== !!b.isPrimary) return a.isPrimary ? -1 : 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      return bound[0];
    });
  }

  /* ---- 拼装角色人设文本：覆盖 characters.js 表单里几乎全部人设字段，
     字段缺失时直接跳过（不要用「未知」「暂无」这类占位词污染人设，
     那样反而会被模型当成实际设定念出来） ---- */
  function buildCharPersonaBlock(charRecord, session) {
    if (!charRecord) {
      // 没有可用的角色档案：只能用会话里的昵称兜底，明确告知模型
      // 人设信息缺失，禁止其自行编造背景设定
      return '【角色人设】\n角色昵称：' + (session.name || '对方') +
        '\n（未找到该角色的完整人设档案，只能依据这个称呼和下方的对话上下文自然回应，' +
        '不要编造角色未曾表露过的具体背景、身份或经历。）';
    }
    var lines = [];
    lines.push('【角色人设 —— 以下设定为最高优先级，务必严格遵守，绝不能 OOC】');
    lines.push('姓名：' + charRecord.name);
    if (charRecord.role) lines.push('定位：' + charRecord.role);
    if (charRecord.gender) lines.push('性别：' + charRecord.gender);
    if (charRecord.age) lines.push('年龄：' + charRecord.age);
    if (charRecord.species) lines.push('种族/身份：' + charRecord.species);
    if (charRecord.desc) lines.push('简介：' + charRecord.desc);
    if (charRecord.appearance) lines.push('外貌：' + charRecord.appearance);
    if (charRecord.outfit) lines.push('穿着：' + charRecord.outfit);
    if (Array.isArray(charRecord.traits) && charRecord.traits.length) lines.push('性格标签：' + charRecord.traits.join('、'));
    if (charRecord.backstory) lines.push('背景故事：' + charRecord.backstory);
    if (charRecord.scenario) lines.push('当前场景设定：' + charRecord.scenario);
    if (Array.isArray(charRecord.likes) && charRecord.likes.length) lines.push('喜欢：' + charRecord.likes.join('、'));
    if (Array.isArray(charRecord.dislikes) && charRecord.dislikes.length) lines.push('讨厌：' + charRecord.dislikes.join('、'));
    if (charRecord.fears) lines.push('恐惧/禁忌：' + charRecord.fears);
    if (charRecord.speechStyle) lines.push('说话风格：' + charRecord.speechStyle);
    if (Array.isArray(charRecord.catchphrases) && charRecord.catchphrases.length) lines.push('口头禅：' + charRecord.catchphrases.join('、'));
    if (charRecord.relation) lines.push('与用户的关系定位：' + charRecord.relation);
    if (charRecord.callUser) lines.push('对用户的称呼：' + charRecord.callUser);
    if (charRecord.relationDetail) lines.push('关系细节：' + charRecord.relationDetail);
    if (Array.isArray(charRecord.neverList) && charRecord.neverList.length) lines.push('绝对不会做的事：' + charRecord.neverList.join('、'));
    if (charRecord.boundaries) lines.push('边界与底线：' + charRecord.boundaries);
    if (charRecord.prompt) lines.push('\n补充设定/系统提示词：\n' + charRecord.prompt);
    if (Array.isArray(charRecord.dialogExamples) && charRecord.dialogExamples.length) {
      lines.push('\n对话风格示例（仅供参考语气与用词，不要照抄内容）：');
      charRecord.dialogExamples.slice(0, 3).forEach(function (d) {
        if (d && (d.user || d.char)) lines.push('用户：' + (d.user || '') + '\n' + charRecord.name + '：' + (d.char || ''));
      });
    }
    return lines.join('\n');
  }

  /* ---- 拼装 user 人设文本：没有绑定身份时明确写「未设定」，
     禁止模型把角色自己的设定误当成用户的设定去回应 ---- */
  function buildUserPersonaBlock(userIdentity, myName) {
    if (!userIdentity) {
      return '【用户人设】\n当前未绑定任何用户身份卡，仅知道用户昵称为「' + (myName || '我') +
        '」，不要凭空假设用户的性别、职业、性格等具体信息。';
    }
    var lines = ['【用户人设 —— 这是你正在对话的这个人，请据此理解 ta 的身份与说话立场】'];
    lines.push('昵称：' + (userIdentity.name || myName || '我'));
    if (userIdentity.gender) lines.push('性别：' + userIdentity.gender);
    if (userIdentity.birthday) lines.push('生日：' + userIdentity.birthday);
    if (userIdentity.location) lines.push('居住地：' + userIdentity.location);
    if (userIdentity.occupation) lines.push('职业：' + userIdentity.occupation);
    if (userIdentity.personality) lines.push('性格：' + userIdentity.personality);
    if (userIdentity.desc) lines.push('简介：' + userIdentity.desc);
    if (userIdentity.motto) lines.push('座右铭：' + userIdentity.motto);
    if (Array.isArray(userIdentity.tags) && userIdentity.tags.length) {
      lines.push('标签：' + userIdentity.tags.map(function (t) { return t && t.text ? t.text : t; }).join('、'));
    }
    return lines.join('\n');
  }

  /* ---- 系统提示词总装：角色人设 + 世界书 + user 人设 三块为最高指令，
     再补一段「短句多条 / 拟人节奏」的格式要求，最后交代当前在线状态、
     禁止自我暴露 AI 身份等既有开关 ---- */
  function buildSystemPrompt(charRecord, session, worldSection, userIdentity, myName) {
    var parts = [];
    parts.push(buildCharPersonaBlock(charRecord, session));
    if (worldSection) parts.push(worldSection);
    parts.push(buildUserPersonaBlock(userIdentity, myName));

    var lang = (charRecord && charRecord.lang) || '中文';
    var pov = (charRecord && charRecord.pov) || '第一人称';
    var noDisclaimer = !charRecord || charRecord.noDisclaimer !== false;
    var noBreak = !charRecord || charRecord.noBreak !== false;

    var rules = [];
    rules.push('【回复格式要求 —— 硬性规则，不是建议，必须严格照做】');
    rules.push('- 使用' + lang + '，以' + pov + '视角回应，完全代入角色本人说话，不要以旁白或助手身份自称。');
    rules.push('- 不必每条都紧扣用户最后一句话，允许有你自己的联想、追问或转折，语气要口语化、碎片化，像真人打字一样，不要写成书面完整段落。');
    if (noBreak) rules.push('- 全程保持角色人设，绝不能跳出角色、绝不能 OOC，也不要提及你在"扮演"或"生成回复"。');
    if (noDisclaimer) rules.push('- 不要添加免责声明、系统提示或"作为 AI"之类的话。');
    rules.push('- 直接给出角色要说的话本身，不要输出任何前缀说明、标签、引号、星号动作或 markdown 格式。');
    rules.push('');
    rules.push('【分条格式 —— 必须遵守，这是硬性输出格式而不是排版建议】');
    rules.push('把要说的话拆成多条独立的短句，条数完全由你这次实际想说多少话自然决定，可以是 2 条，也可以是 6 条、8 条甚至更多，不设固定条数，条与条之间必须用竖线 ||| 分隔（不要用换行、不要用句号顿号代替）。');
    rules.push('每一条控制在一句话以内，不要在一条里塞多个意思，想到什么就单独一条发出来，越碎越像真人打字。');
    rules.push('不要把 ||| 漏掉写成不分割的整段话，除非你这次真的只想说一句极短的话。');
    rules.push('正确示例：没有呀|||也不晚呀|||这会儿都准备去睡觉了呢|||你不是也应该要睡了嘛');
    rules.push('错误示例（禁止这样输出）：没有呀，也不晚呀，这会儿都准备去睡觉了呢，你不是也应该要睡了嘛');
    parts.push(rules.join('\n'));

    return parts.join('\n\n');
  }

  /* ---- 组装发给 API 的 messages：system + 最近历史（映射 from:'me'→user，
     from:'peer'→assistant）。历史条数超过上限时只取最近一段，
     避免 prompt 无限增长 ---- */
  function buildChatMessages(systemPrompt, history, myName) {
    var msgs = [{ role: 'system', content: systemPrompt }];
    var trimmed = (history || []).slice(-AI_CONTEXT_LIMIT);
    trimmed.forEach(function (m) {
      msgs.push({ role: m.from === 'me' ? 'user' : 'assistant', content: m.text || '' });
    });
    if (!trimmed.length) {
      msgs.push({ role: 'user', content: '（对话刚刚开始，请你先自然地开口说点什么）' });
    }
    return msgs;
  }

  /* ---- 读取 settings.js 里保存的 AI 接口配置：luna_api_current
     (baseUrl/apiKey) + luna_api_model，三者缺一都视为未配置 ---- */
  function readApiConfig() {
    try {
      var cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
      var model = localStorage.getItem('luna_api_model') || '';
      if (!cur.baseUrl || !cur.apiKey || !model) return null;
      return { baseUrl: String(cur.baseUrl).replace(/\/$/, ''), apiKey: cur.apiKey, model: model };
    } catch (e) { return null; }
  }

  /* ---- 调用 OpenAI 兼容 /chat/completions 接口，与 settings.js
     sendApiTest() 的请求形态保持一致 ---- */
  function callAiApi(cfg, messages) {
    return fetch(cfg.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + cfg.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: messages,
        max_tokens: 1600,
        temperature: 0.9
      })
    }).then(function (resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.json();
    }).then(function (data) {
      var reply = data && data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content : '';
      return (reply || '').trim();
    });
  }

  /* ---- 把模型返回的文本拆成多条短句气泡 ----
     策略优先级（从高到低），全程不设任何数量上下限、不做任何
     合并压缩——切出几条就是几条，1 条也好、10 条也好，完全由
     模型这一次实际想说多少话决定，这才是真随机、真活人感：
     1) 模型如果按 system prompt 里要求的 ||| 分隔符输出，直接按
        ||| 切，这是最可靠的信号。
     2) 模型没给 ||| 时（不能假设它 100% 听话，必须有 fallback），
        依次尝试换行、中文/英文句末标点、逗号顿号，取第一种能切出
        2 条以上的粒度。
     3) 连逗号顿号都没有、确实就是一句极短话时，才会只有 1 条——
        这不是被代码限制出来的，是内容本身就只有这么多。 ---- */
  function splitIntoOddSegments(text) {
    var raw = text.trim();
    if (!raw) return [];

    // 优先级 1：按约定分隔符切
    if (raw.indexOf('|||') !== -1) {
      var byDelim = raw.split(/\s*\|\|\|\s*/).map(function (s) { return s.trim(); }).filter(Boolean);
      if (byDelim.length >= 2) return byDelim;
    }

    // 优先级 2：逐级放宽的 fallback 切分——换行 → 句末标点 → 逗号顿号
    var attempts = [
      function () { return raw.split(/\n+/); },
      function () { return raw.split(/(?<=[。！？!?~…])\s*/); },
      function () { return raw.split(/(?<=[，,、])\s*/); }
    ];
    for (var i = 0; i < attempts.length; i++) {
      var pieces = attempts[i]().map(function (s) { return s.trim(); }).filter(Boolean);
      if (pieces.length >= 2) return pieces;
    }

    // 优先级 3：确实切不出多条，只能保留原文一整条
    return [raw];
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

  function formatWeekdayEn(d) {
    var names = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return names[d.getDay()];
  }
})();