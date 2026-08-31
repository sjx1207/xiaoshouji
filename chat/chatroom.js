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
      sendBtn: document.getElementById('crmSendBtn'),
      quotePending: document.getElementById('crmQuotePending'),
      quotePendingWho: document.getElementById('crmQuotePendingWho'),
      quotePendingText: document.getElementById('crmQuotePendingText'),
      quotePendingClose: document.getElementById('crmQuotePendingClose')
    };

    var myAvatarUrl = null;
    var myName = '我';
    var aiSuggestEl = null;
    var msgGroupSeq = 0; // 用于给每个头像的 SVG mask 生成唯一 id
    var pendingQuote = null; // { ts, from, text } —— 用户当前准备随下一条消息一起发出的引用

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

    /* ---- 待发送引用条：由长按菜单「引用」触发 setPendingQuote，
       随下一条 sendMessage 一并写入 msg.quote，发送后自动清空；
       也可在发送前手动点 ✕ 取消 ---- */
    function setPendingQuote(msg, isMe) {
      pendingQuote = { ts: msg.ts, from: msg.from, text: msg.text || '' };
      renderPendingQuote(isMe);
      if (els.textarea) els.textarea.focus();
    }
    function clearPendingQuote() {
      pendingQuote = null;
      if (els.quotePending) {
        els.quotePending.classList.remove('is-open');
        els.quotePending.setAttribute('aria-hidden', 'true');
      }
    }
    function renderPendingQuote(isMe) {
      if (!els.quotePending) return;
      els.quotePendingWho.textContent = isMe ? (myName || '我') : (session.name || '好友');
      els.quotePendingText.textContent = pendingQuote.text;
      els.quotePending.classList.add('is-open');
      els.quotePending.setAttribute('aria-hidden', 'false');
    }
    if (els.quotePendingClose) {
      els.quotePendingClose.addEventListener('click', clearPendingQuote);
    }

    /* ---- 点击气泡内的引用卡：回跳到被引用的原消息并短暂高亮，
       用时间戳 + 发送方精确定位；原消息已被删除时不做任何跳转 ---- */
    function jumpToQuoted(ts, from) {
      var target = els.scrollInner.querySelector(
        '.crm-bubble[data-msg-ts="' + ts + '"][data-msg-from="' + from + '"]'
      );
      if (!target) { showFlashToast('原消息已不存在'); return; }
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.remove('is-quote-highlight');
      // 强制重排以重启动画
      void target.offsetWidth;
      target.classList.add('is-quote-highlight');
      setTimeout(function () { target.classList.remove('is-quote-highlight'); }, 1550);
    }
    window.__crmJumpToQuoted = jumpToQuoted; // 供气泡内联事件调用

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

      var consumedDeleteNotes = null;

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
        // 读取并消费"AI 消息被删"线索簿：读到即用掉，避免下次重复提醒；
        // 若这次生成最终失败，会在 catch 里把它们放回线索簿，不会白白丢失
        consumedDeleteNotes = await consumeDeleteLog(storeKey);

        // ---- 引用能力：把最近若干条消息编号列进 quotable 索引，
        // 供模型在「确实合适」时用 [[quote:N]] 引用其中一条 ----
        var quotableIndex = buildQuotableIndex(history);
        var quoteAllowed = await isQuoteTurnAllowed(storeKey);

        // ---- 撤回能力：与引用同一套"节流器 + 概率"机制，只在被
        // 判定"这一轮恰好轮到"时，才把撤回语法写进 prompt 并在
        // 解析阶段真正生效，绝不会每次回复都触发撤回 ----
        var recallAllowed = await isRecallTurnAllowed(storeKey);

        var systemPrompt = buildSystemPrompt(charRecord, session, worldSection, userIdentity, myName, consumedDeleteNotes, quotableIndex, quoteAllowed, recallAllowed);
        var chatMessages  = buildChatMessages(systemPrompt, history, myName);

        if (aiAbort) { finishAiThinking(); return; }

        var replyText = await callAiApi(apiCfg, chatMessages);
        if (aiAbort) { finishAiThinking(); return; }
        if (!replyText) {
          finishAiThinking();
          showAiToast('AI 没有返回内容，请稍后再试');
          if (consumedDeleteNotes && consumedDeleteNotes.length) await requeueDeleteLog(storeKey, consumedDeleteNotes);
          return;
        }

        var segments = splitIntoOddSegments(replyText);
        await appendAiSegments(segments, quotableIndex, quoteAllowed, recallAllowed);
      } catch (err) {
        showAiToast('生成失败：' + (err && err.message ? err.message : '请检查网络与接口配置'));
        if (consumedDeleteNotes && consumedDeleteNotes.length) await requeueDeleteLog(storeKey, consumedDeleteNotes);
      } finally {
        finishAiThinking();
      }
    }

    /* ---- 依次把拆好的多条短句作为角色的多条消息写入并渲染，
       条与条之间加一点错落的停顿，模拟真人连续发送的节奏。
       —— 引用解析：只有这次生成被 isQuoteTurnAllowed 判定为
       「允许引用」时，才会去解析段落开头的 [[quote:N]] 标记；
       否则即便模型手滑写了这个标记，也原样当普通文字发出去，
       从代码层面兜底"绝不会每次都引用"这条硬性要求，而不是
       只靠 system prompt 里的一句话去约束模型的自觉性。
       同一整轮回复（无论拆成多少条）最多只让第一条命中的
       引用生效一次，避免模型在同一轮里连续引用好几条。
       —— 撤回解析：同理，只有 recallAllowed 为真时才解析段落
       开头的 [[recall]] 标记；命中的那一条会先正常地发出来、
       停顿一小段像是"手滑发出去了"的时间，再当着用户的面把它
       翻成"撤回了一条消息"——这正是"撤回"的本质：曾经说过，
       只是反悔收回，而不是从一开始就不存在。同一轮最多只让
       一条命中撤回，且撤回动作在这一条之后才继续发送剩余的话，
       模拟"发错了赶紧撤，然后正常接着往下说"的真实节奏 ---- */
    async function appendAiSegments(segments, quotableIndex, quoteAllowed, recallAllowed) {
      var quoteUsedThisTurn = false;
      var recallUsedThisTurn = false;
      for (var i = 0; i < segments.length; i++) {
        if (aiAbort) return;
        var seg = segments[i];
        if (!seg) continue;

        var msg = { from: 'peer', text: seg, ts: Date.now() };
        var wantsRecall = false;

        if (recallAllowed && !recallUsedThisTurn) {
          var recallParsed = extractRecallTag(seg);
          if (recallParsed) {
            seg = recallParsed;
            wantsRecall = true;
          }
        } else {
          seg = stripRecallTag(seg);
        }

        if (quoteAllowed && !quoteUsedThisTurn) {
          var parsed = extractQuoteTag(seg, quotableIndex);
          if (parsed) {
            msg.text = parsed.text;
            msg.quote = parsed.quote;
            quoteUsedThisTurn = true;
          } else {
            // 这一条虽然处在"允许引用"的窗口里，但标记没能成功解析
            // （编号非法、引用目标缺失，或标记没能精确出现在这一条
            // 短句的最前面，比如模型在标记前多打了字/标点）——无论
            // 哪种情况，都不能把 [[quote:N]] 原始标记暴露给用户，
            // 必须兜底剥掉，只是不消耗本轮的引用名额
            msg.text = stripQuoteTag(seg);
          }
        } else {
          // 未获准引用的这一轮：即使模型写了标记，也只是把标记本身
          // 干净地剥掉，绝不把它当引用生效，也不把标记原文暴露给用户
          msg.text = stripQuoteTag(seg);
        }
        if (!msg.text) continue;

        var list = await loadMessages(storeKey);
        list.push(msg);
        await saveMessages(storeKey, list);
        renderAll(list, els, session);
        scrollToBottom(els, true);
        if (window.LunaMessagesBus) window.LunaMessagesBus.notify();

        if (wantsRecall) {
          // 先让这条消息正常显示一小会儿（"已经发出去了"的真实感），
          // 再翻成撤回态——时间比条与条之间的常规停顿略长，更接近
          // "反应过来手滑了，赶紧撤"的节奏
          recallUsedThisTurn = true;
          await wait(650 + Math.random() * 550);
          if (aiAbort) return;
          var recallList = await loadMessages(storeKey);
          var ridx = recallList.findIndex(function (m) { return m.ts === msg.ts && m.from === 'peer'; });
          if (ridx !== -1) {
            recallList[ridx] = Object.assign({}, recallList[ridx], {
              recalled: true,
              recalledAt: Date.now(),
              recalledBy: 'peer'
            });
            await saveMessages(storeKey, recallList);
            renderAll(recallList, els, session);
            if (window.LunaMessagesBus) window.LunaMessagesBus.notify();
          }
        }

        if (i < segments.length - 1) {
          await wait(320 + Math.random() * 520);
        }
      }
      if (quoteUsedThisTurn) await markQuoteTurnUsed(storeKey);
      else await bumpQuoteTurnCounter(storeKey);
      if (recallUsedThisTurn) await markRecallTurnUsed(storeKey);
      else await bumpRecallTurnCounter(storeKey);
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
      if (pendingQuote) {
        msg.quote = pendingQuote;
        clearPendingQuote();
      }
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

        /* ---- 已撤回的消息：不参与左右气泡分组，独立渲染成一条
           居中系统行——撤回条本身不可被隐藏或跳过，永远单独占一行，
           不会因为紧挨着同发送方的其它消息而被误并入气泡串 ---- */
        if (msg.recalled) {
          inner.appendChild(buildRecallRow(msg, msg.from === 'me', myName, session));
          i++;
          continue;
        }

        /* ---- 连续同发送方、且都未撤回的消息归并为一个「气泡串」组，
           组内共享同一条纵向渐变，让渐变感贯穿多条消息，
           而非每条气泡各自独立渐变；一旦遇到撤回消息就断开分组 ---- */
        var group = [msg];
        var j = i + 1;
        while (j < list.length && list[j].from === msg.from && !list[j].recalled) {
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

      var ctx = {
        storeKey: storeKey,
        els: els,
        session: session,
        myName: myName,
        loadMessages: loadMessages,
        saveMessages: saveMessages,
        renderAll: renderAll,
        scrollToBottom: scrollToBottom,
        setPendingQuote: setPendingQuote
      };

      msgs.forEach(function (msg, idx) {
        var bubble = document.createElement('div');
        bubble.className = 'crm-bubble' + (msg.text && msg.text.length > 60 ? ' has-divider' : '');
        if (idx === 0) bubble.classList.add('is-first');
        if (idx === msgs.length - 1) bubble.classList.add('is-last');
        bubble.setAttribute('data-msg-ts', String(msg.ts));
        bubble.setAttribute('data-msg-from', msg.from);

        var inner = document.createElement('div');
        inner.className = 'crm-bubble-inner';

        if (msg.forward) {
          inner.appendChild(buildForwardTag(msg.forward));
        }

        if (msg.quote) {
          inner.appendChild(buildQuoteRefChip(msg.quote));
        }

        if (msg.bundle) {
          inner.appendChild(buildBundleCard(msg.bundle));
        } else {
          var textEl = document.createElement('div');
          textEl.className = 'crm-bubble-text';
          textEl.textContent = msg.text;
          inner.appendChild(textEl);
        }

        bubble.appendChild(inner);

        bubble.addEventListener('click', function (evt) {
          evt.stopPropagation();
          if (isMultiSelectOn()) {
            toggleMselPick(msg, check, ctx);
            return;
          }
          if (msg.bundle) {
            openBundleDetail(msg.bundle, isMe, ctx);
            return;
          }
          openSelectMenu(bubble, msg, isMe, ctx);
        });

        var time = document.createElement('div');
        time.className = 'crm-msg-time';
        time.textContent = formatAmPm(new Date(msg.ts));

        var check = document.createElement('span');
        check.className = 'crm-msel-check';
        check.setAttribute('aria-hidden', 'true');
        check.innerHTML = '<span class="crm-msel-check-ring"><svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 12.5L10 17.5L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
        check.addEventListener('click', function (evt) {
          evt.stopPropagation();
          toggleMselPick(msg, check, ctx);
        });

        /* 长按（触屏）直接进入多选并勾选当前这条，与「多选」菜单项
           入口互为补充——鼠标端仍走菜单里的「多选」按钮 */
        bindLongPressToMultiSelect(bubble, msg, ctx, check);

        var wrap = document.createElement('div');
        wrap.className = 'crm-bubble-wrap';
        wrap.appendChild(bubble);
        wrap.appendChild(time);

        var row = document.createElement('div');
        row.className = 'crm-msel-row';
        row.setAttribute('data-msg-ts', String(msg.ts));
        if (isMe) {
          row.appendChild(check);
          row.appendChild(wrap);
        } else {
          row.appendChild(wrap);
          row.appendChild(check);
        }
        stream.appendChild(row);
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

    /* ---- 气泡内嵌引用卡：显示"谁 · 说了什么"的浓缩预览，
       点击回跳并高亮原消息。原消息若已被删除，改显示一句
       「原消息已删除」的浅色斜体提示，不阻断渲染 ---- */
    function buildQuoteRefChip(quote) {
      var chip = document.createElement('div');
      chip.className = 'crm-quote-ref';
      chip.setAttribute('role', 'button');

      var bar = document.createElement('span');
      bar.className = 'crm-quote-ref-bar';
      bar.setAttribute('aria-hidden', 'true');

      var body = document.createElement('span');
      body.className = 'crm-quote-ref-body';

      var who = document.createElement('span');
      who.className = 'crm-quote-ref-who';
      who.textContent = quote.from === 'me' ? (myName || '我') : (session.name || '好友');

      var text = document.createElement('span');
      text.className = 'crm-quote-ref-text';
      text.textContent = quote.text ? quote.text : '原消息已删除';
      if (!quote.text) text.classList.add('is-missing');

      body.appendChild(who);
      body.appendChild(text);
      chip.appendChild(bar);
      chip.appendChild(body);

      chip.addEventListener('click', function (evt) {
        evt.stopPropagation();
        jumpToQuoted(quote.ts, quote.from);
      });

      return chip;
    }

    /* ---- 气泡内嵌转发标签：安静的顶部一行"转发自 谁"，
       与引用签共享同一处「浅色磨砂卡片嵌在气泡里」的语法位置，
       但形式更轻——只是一条细分隔线 + 折角印记 + 来源姓名，
       暗示"这段话并非这个人自己所说"，下方仍完整显示转发正文 ---- */
    function buildForwardTag(fwd) {
      var tag = document.createElement('div');
      tag.className = 'crm-fwd-tag';

      var glyph = document.createElement('span');
      glyph.className = 'crm-fwd-tag-glyph';
      glyph.setAttribute('aria-hidden', 'true');
      glyph.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M13.5 6L19.5 12L13.5 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 17V14C4.5 11.2 6.7 9 9.5 9H19" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

      var text = document.createElement('span');
      text.className = 'crm-fwd-tag-text';
      text.textContent = '转发自 ' + (fwd.fromName || '好友');

      tag.appendChild(glyph);
      tag.appendChild(text);
      return tag;
    }

    /* ---- 批量转发 · 合并气泡内容："聊天记录"标题 + 前两条摘要 +
       "共 N 条消息"，点击整条气泡（在外层 bubble.click 里）会打开
       只读详情页，不在这里绑定任何交互 ---- */
    function buildBundleCard(bundle) {
      var card = document.createElement('div');
      card.className = 'crm-bundle-card';

      var head = document.createElement('div');
      head.className = 'crm-bundle-card-head';
      var glyph = document.createElement('span');
      glyph.className = 'crm-bundle-card-glyph';
      glyph.setAttribute('aria-hidden', 'true');
      glyph.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 8H16.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M13.5 4.5L17 8L13.5 11.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 16H7.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M10.5 12.5L7 16L10.5 19.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      var title = document.createElement('span');
      title.className = 'crm-bundle-card-title';
      title.textContent = '聊天记录';
      head.appendChild(glyph);
      head.appendChild(title);

      var lines = document.createElement('div');
      lines.className = 'crm-bundle-card-lines';
      var items = bundle.items || [];
      items.slice(0, 2).forEach(function (it) {
        var line = document.createElement('div');
        line.className = 'crm-bundle-card-line';
        var who = document.createElement('b');
        who.textContent = (it.from === 'me' ? (myName || '我') : (session.name || '好友')) + '：';
        line.appendChild(who);
        line.appendChild(document.createTextNode(it.text || (it.bundle ? '[聊天记录]' : '')));
        lines.appendChild(line);
      });

      var count = document.createElement('div');
      count.className = 'crm-bundle-card-count';
      count.textContent = '共 ' + items.length + ' 条消息';

      card.appendChild(head);
      card.appendChild(lines);
      card.appendChild(count);
      return card;
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
      { key: 'recall', label: '撤回', icon: iconRecall(), danger: true, meOnly: true },
      { key: 'delete', label: '删除', icon: iconDelete(), danger: true }
    ]
  ];

  function openSelectMenu(bubbleEl, msg, isMe, ctx) {
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
      var visibleItems = group.filter(function (item) {
        // 「撤回」只有用户能对自己发的消息使用，与微信一致——
        // AI（对方）消息不允许被用户手动撤回，只能由 AI 自己触发
        return !(item.meOnly && !isMe);
      });
      if (!visibleItems.length) return;
      visibleItems.forEach(function (item) {
        var row = document.createElement('button');
        row.type = 'button';
        row.className = 'crm-select-menu-row' + (item.danger ? ' is-danger' : '');
        row.innerHTML =
          '<span class="crm-select-menu-label">' + item.label + '</span>' +
          '<span class="crm-select-menu-icon" aria-hidden="true">' + item.icon + '</span>';
        row.addEventListener('click', function () {
          if (item.key === 'copy') {
            handleCopyAction(msg);
            closeSelectMenu();
          } else if (item.key === 'quote') {
            closeSelectMenu();
            if (ctx.setPendingQuote) ctx.setPendingQuote(msg, isMe);
          } else if (item.key === 'star') {
            closeSelectMenu();
            if (window.LunaFavorites) {
              window.LunaFavorites.addMessageFavorite(msg, ctx.session).then(function (res) {
                if (res && res.ok) {
                  showFlashToast('已加入收藏');
                } else {
                  showFlashToast('这条消息已在收藏中');
                }
              });
            }
          } else if (item.key === 'edit') {
            closeSelectMenu();
            openEditModal(msg, isMe, ctx);
          } else if (item.key === 'recall') {
            closeSelectMenu();
            if (isMe) applyUserRecall(msg, ctx);
          } else if (item.key === 'delete') {
            closeSelectMenu();
            openDeleteModal(msg, isMe, ctx);
          } else if (item.key === 'forward') {
            closeSelectMenu();
            openForwardPicker(msg, isMe, ctx);
          } else if (item.key === 'multi') {
            closeSelectMenu();
            var rowEl = document.querySelector('.crm-msel-row[data-msg-ts="' + CSS.escape(String(msg.ts)) + '"]');
            var checkEl = rowEl ? rowEl.querySelector('.crm-msel-check') : null;
            enterMultiSelect(ctx, msg, checkEl);
          } else {
            /* 其余功能占位：具体业务逻辑后续接入，这里先统一收起面板 */
            closeSelectMenu();
          }
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

  /* ==========================================================================
     复制消息 —— 把气泡原文写入系统剪贴板，成功/失败都给出轻量反馈胶囊
  ========================================================================== */
  function handleCopyAction(msg) {
    var text = (msg && msg.text) || '';
    var done = function (ok) {
      showFlashToast(ok ? '已复制' : '复制失败，请手动选择文字');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else {
      // 退化方案：不支持 Clipboard API 时用隐藏 textarea + execCommand
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        done(ok);
      } catch (e) { done(false); }
    }
  }

  var flashToastEl = null;
  var flashToastTimer = null;
  function showFlashToast(text) {
    if (!flashToastEl) {
      flashToastEl = document.createElement('div');
      flashToastEl.className = 'crm-flash-toast';
      document.body.appendChild(flashToastEl);
    }
    clearTimeout(flashToastTimer);
    flashToastEl.textContent = text;
    requestAnimationFrame(function () { flashToastEl.classList.add('is-open'); });
    flashToastTimer = setTimeout(function () {
      if (flashToastEl) flashToastEl.classList.remove('is-open');
    }, 1600);
  }

  /* ==========================================================================
     消息修改弹窗 —— 水平垂直居中
     —— 用户自己发的消息：直接编辑文字并覆盖存储，之后送入 AI 的
        上下文会读取到修改后的这一版，不会再带上修改前的原文（因为
        上下文本来就是实时从存储里读最新记录，覆盖后旧文本已不存在，
        天然满足"只让 AI 看到修改后的内容"这条要求）。
     —— AI（对方）自己说过的话：本质上代表"这条 AI 回复不满意 /
        OOC，我要把它掰成我认可的样子"，保存后同样覆盖存储里的原文，
        这样之后 AI 生成新回复时，读到的历史记录里这一条已经是
        用户修改过、认可的版本——AI 会把它当成"自己确实说过这句话"
        来续写后续对话，而不是仍然记得自己原本想说的那句。
        这正是"必须接受这条被修改的回复"的含义：不提供任何"恢复
        原文"的入口，修改即定稿，成为对话历史的唯一真相。 ---- */
  var editState = null; // { msg, isMe, ctx }

  function getEditEls() {
    return {
      mask: document.getElementById('crmEditMask'),
      modal: document.getElementById('crmEditModal'),
      titleCn: document.getElementById('crmEditTitleCn'),
      titleEn: document.getElementById('crmEditTitleEn'),
      hint: document.getElementById('crmEditHint'),
      textarea: document.getElementById('crmEditTextarea'),
      cancelBtn: document.getElementById('crmEditCancelBtn'),
      saveBtn: document.getElementById('crmEditSaveBtn')
    };
  }

  var editElsBound = false;
  function bindEditModalOnce() {
    if (editElsBound) return;
    editElsBound = true;
    var e = getEditEls();
    if (!e.mask || !e.modal) return;
    e.mask.addEventListener('click', function () { closeEditModal(); });
    e.cancelBtn.addEventListener('click', function () { closeEditModal(); });
    e.saveBtn.addEventListener('click', function () { saveEditModal(); });
    e.textarea.addEventListener('input', function () {
      e.saveBtn.disabled = e.textarea.value.trim().length === 0;
    });
    document.addEventListener('keydown', function (evt) {
      if (!editState) return;
      if (evt.key === 'Escape') closeEditModal();
    });
  }

  function openEditModal(msg, isMe, ctx) {
    bindEditModalOnce();
    var e = getEditEls();
    if (!e.mask || !e.modal) return;

    editState = { msg: msg, isMe: isMe, ctx: ctx };

    if (isMe) {
      e.titleCn.textContent = '修改消息';
      e.titleEn.textContent = 'EDIT MESSAGE';
      e.hint.hidden = true;
    } else {
      e.titleCn.textContent = '修改 AI 回复';
      e.titleEn.textContent = 'EDIT AI REPLY';
      e.hint.hidden = false;
      e.hint.textContent = '保存后这条回复会被视为角色确实这样说过，将替换原文并写入聊天记录，后续 AI 续写对话时会以这个修改后的版本为准，不会再看到修改前的内容。';
    }

    e.textarea.value = msg.text || '';
    e.saveBtn.disabled = e.textarea.value.trim().length === 0;

    e.mask.classList.add('is-open');
    e.modal.classList.add('is-open');
    e.mask.setAttribute('aria-hidden', 'false');
    e.modal.setAttribute('aria-hidden', 'false');

    requestAnimationFrame(function () {
      e.textarea.focus();
      var len = e.textarea.value.length;
      try { e.textarea.setSelectionRange(len, len); } catch (err) {}
    });
  }

  function closeEditModal() {
    if (!editState) return;
    editState = null;
    var e = getEditEls();
    if (!e.mask || !e.modal) return;
    e.mask.classList.remove('is-open');
    e.modal.classList.remove('is-open');
    e.mask.setAttribute('aria-hidden', 'true');
    e.modal.setAttribute('aria-hidden', 'true');
  }

  function saveEditModal() {
    if (!editState) return;
    var e = getEditEls();
    var newText = e.textarea.value.trim();
    if (!newText) return;

    var st = editState;
    var ctx = st.ctx;
    if (!ctx || !ctx.loadMessages || !ctx.saveMessages) { closeEditModal(); return; }

    e.saveBtn.disabled = true;

    ctx.loadMessages(ctx.storeKey).then(function (list) {
      list = list || [];
      /* 用时间戳 + 发送方精确定位到这一条，而不是按数组下标——
         渲染时数组已经过重新加载，下标可能与打开弹窗时不一致 */
      var idx = list.findIndex(function (m) {
        return m.ts === st.msg.ts && m.from === st.msg.from;
      });
      if (idx === -1) return list;
      list[idx] = Object.assign({}, list[idx], { text: newText, edited: true, editedAt: Date.now() });
      return ctx.saveMessages(ctx.storeKey, list).then(function () { return list; });
    }).then(function (list) {
      if (list && ctx.els && ctx.session && ctx.renderAll) {
        ctx.renderAll(list, ctx.els, ctx.session);
      }
      if (window.LunaMessagesBus) window.LunaMessagesBus.notify();
      closeEditModal();
      showFlashToast('已保存修改');
    }).catch(function () {
      e.saveBtn.disabled = false;
      showFlashToast('保存失败，请重试');
    });
  }

  /* ==========================================================================
     删除确认弹窗 —— 水平垂直居中
     —— 用户自己发的消息：确认后直接从存储数组里移除，没有任何
        特殊记录，纯粹的"消失"。
     —— AI（对方）自己说过的话：删除同样会把它从对话记录里移除，
        但额外在这个会话专属的"删除线索簿"里追加一条记录（原文
        摘要 + 删除时间），供下一次调用 AI 生成回复时读取并拼进
        system prompt——让 AI 明确知道"我之前说过的某句话被用户
        删掉了，大概率是内容多余、乱码或者不符合人设"，从而在
        接下来的回复里自然地调整语气或内容方向，而不是浑然不知、
        重复同样的问题。线索簿只保留最近若干条，且每条只在"紧跟
        删除动作之后的下一次生成"里被读取一次，避免无限期地反复
        提醒模型同一件旧事、把 prompt 越堆越臃肿。 ---- */
  var deleteState = null; // { msg, isMe, ctx }
  var DELETE_LOG_LIMIT = 5; // 每个会话最多保留最近 5 条"AI 消息被删"的线索

  function delLogKey(storeKey) { return 'chatroomDelLog:' + storeKey; }

  function loadDeleteLog(storeKey) {
    if (window.LunaDB) return window.LunaDB.get(delLogKey(storeKey)).then(function (v) { return v || []; });
    return Promise.resolve([]);
  }
  function saveDeleteLog(storeKey, list) {
    if (window.LunaDB) return window.LunaDB.set(delLogKey(storeKey), list);
    return Promise.resolve(false);
  }
  /* 追加一条"AI 消息被删"线索，超出上限时丢弃最旧的一条 */
  function appendDeleteLog(storeKey, text) {
    return loadDeleteLog(storeKey).then(function (list) {
      list = list || [];
      list.push({ text: text, ts: Date.now() });
      if (list.length > DELETE_LOG_LIMIT) list = list.slice(list.length - DELETE_LOG_LIMIT);
      return saveDeleteLog(storeKey, list);
    });
  }
  /* 生成回复前读取并"消费"这份线索簿——读到就代表这次要用上了，
     用完立即清空，不会在下一次生成时被重复提醒同一批旧记录 */
  function consumeDeleteLog(storeKey) {
    return loadDeleteLog(storeKey).then(function (list) {
      if (!list || !list.length) return [];
      return saveDeleteLog(storeKey, []).then(function () { return list; });
    });
  }
  /* 生成失败（接口报错/空回复）时，把刚消费掉的线索放回去，
     避免因为这一次生成失败就白白丢失"AI 消息被删"的记录 */
  function requeueDeleteLog(storeKey, notes) {
    return loadDeleteLog(storeKey).then(function (list) {
      list = (list || []).concat(notes);
      if (list.length > DELETE_LOG_LIMIT) list = list.slice(list.length - DELETE_LOG_LIMIT);
      return saveDeleteLog(storeKey, list);
    });
  }

  function getDelEls() {
    return {
      mask: document.getElementById('crmDelMask'),
      modal: document.getElementById('crmDelModal'),
      titleCn: document.getElementById('crmDelTitleCn'),
      preview: document.getElementById('crmDelPreview'),
      hint: document.getElementById('crmDelHint'),
      cancelBtn: document.getElementById('crmDelCancelBtn'),
      confirmBtn: document.getElementById('crmDelConfirmBtn')
    };
  }

  var delElsBound = false;
  function bindDeleteModalOnce() {
    if (delElsBound) return;
    delElsBound = true;
    var e = getDelEls();
    if (!e.mask || !e.modal) return;
    e.mask.addEventListener('click', function () { closeDeleteModal(); });
    e.cancelBtn.addEventListener('click', function () { closeDeleteModal(); });
    e.confirmBtn.addEventListener('click', function () { confirmDeleteModal(); });
    document.addEventListener('keydown', function (evt) {
      if (!deleteState) return;
      if (evt.key === 'Escape') closeDeleteModal();
    });
  }

  function openDeleteModal(msg, isMe, ctx) {
    bindDeleteModalOnce();
    var e = getDelEls();
    if (!e.mask || !e.modal) return;

    deleteState = { msg: msg, isMe: isMe, ctx: ctx };

    e.titleCn.textContent = isMe ? '删除这条消息？' : '删除这条 AI 回复？';
    e.preview.textContent = msg.text || '';

    if (isMe) {
      e.hint.hidden = true;
    } else {
      e.hint.hidden = false;
      e.hint.textContent = '删除后会记入这个角色的"线索簿"：下次它开口时会知道自己刚才有一句话被你删掉了，多半是内容多余、乱码或者不符合人设，AI 会据此自然调整接下来的回复方式，不会重复同样的问题。';
    }

    e.confirmBtn.disabled = false;

    e.mask.classList.add('is-open');
    e.modal.classList.add('is-open');
    e.mask.setAttribute('aria-hidden', 'false');
    e.modal.setAttribute('aria-hidden', 'false');
  }

  function closeDeleteModal() {
    if (!deleteState) return;
    deleteState = null;
    var e = getDelEls();
    if (!e.mask || !e.modal) return;
    e.mask.classList.remove('is-open');
    e.modal.classList.remove('is-open');
    e.mask.setAttribute('aria-hidden', 'true');
    e.modal.setAttribute('aria-hidden', 'true');
  }

  function confirmDeleteModal() {
    if (!deleteState) return;
    var e = getDelEls();
    var st = deleteState;
    var ctx = st.ctx;
    if (!ctx || !ctx.loadMessages || !ctx.saveMessages) { closeDeleteModal(); return; }

    e.confirmBtn.disabled = true;

    ctx.loadMessages(ctx.storeKey).then(function (list) {
      list = list || [];
      var idx = list.findIndex(function (m) {
        return m.ts === st.msg.ts && m.from === st.msg.from;
      });
      if (idx === -1) return list;
      list.splice(idx, 1);
      return ctx.saveMessages(ctx.storeKey, list).then(function () { return list; });
    }).then(function (list) {
      var afterSave = function () {
        if (list && ctx.els && ctx.session && ctx.renderAll) {
          ctx.renderAll(list, ctx.els, ctx.session);
        }
        if (window.LunaMessagesBus) window.LunaMessagesBus.notify();
        closeDeleteModal();
        showFlashToast('已删除');
      };
      if (!st.isMe) {
        // AI 自己的消息被删：追加进这个会话的删除线索簿，供下次生成读取
        return appendDeleteLog(ctx.storeKey, st.msg.text || '').then(afterSave);
      }
      afterSave();
    }).catch(function () {
      e.confirmBtn.disabled = false;
      showFlashToast('删除失败，请重试');
    });
  }

  /* ==========================================================================
     撤回功能 —— 撤回的本质：这条消息「曾经被说出口，但说话人反悔
     收回了」，与删除完全不同——删除是彻底抹去存在的痕迹，撤回则是
     保留「有过这么一条」的公开记录，只是把内容收起来，且默许对方
     仍能点开看一眼（这正是微信撤回的核心：留痕但不强制隐藏）。
     因此实现上不能像删除那样把消息从数组里 splice 掉，而是把消息
     原地标记为 recalled: true，正文原样保留在 msg.text 里不动，
     只是渲染时改走「居中撤回条」而不是常规左右气泡；点击撤回条
     即用原文本身渲染出可展开的还原卡，不经过任何弹窗。
     —— 用户只能撤回自己发的消息（撤回菜单项已在 openSelectMenu 里
        用 meOnly 过滤，isMe=false 时这一项根本不会出现在菜单里）。
     —— AI 的消息由角色自己「主动」触发撤回，详见文件末尾的
        AI 撤回判定（isRecallTurnAllowed / [[recall]] 标记），
        用户不能代替 AI 撤回它自己的消息，这与"我只能撤回我自己
        发的话"这一现实规则完全对称。
  ========================================================================== */

  /* ---- 用户撤回自己的消息：无需二次确认弹窗（与微信一致，撤回本身
     已经是可逆的"仍可点开看"操作，不是删除那种不可逆的破坏性动作，
     不需要像删除一样拦一道居中确认） ---- */
  function applyUserRecall(msg, ctx) {
    if (!ctx || !ctx.loadMessages || !ctx.saveMessages) return;
    ctx.loadMessages(ctx.storeKey).then(function (list) {
      list = list || [];
      var idx = list.findIndex(function (m) {
        return m.ts === msg.ts && m.from === msg.from;
      });
      if (idx === -1) return null;
      list[idx] = Object.assign({}, list[idx], {
        recalled: true,
        recalledAt: Date.now(),
        recalledBy: 'me'
      });
      return ctx.saveMessages(ctx.storeKey, list).then(function () { return list; });
    }).then(function (list) {
      if (!list) return;
      if (ctx.els && ctx.session && ctx.renderAll) ctx.renderAll(list, ctx.els, ctx.session);
      if (window.LunaMessagesBus) window.LunaMessagesBus.notify();
      showFlashToast('已撤回');
    }).catch(function () {
      showFlashToast('撤回失败，请重试');
    });
  }

  /* ---- 撤回条的展开/收起：纯前端交互状态，不落库——每次渲染都是
     默认收起，点开只是当次会话内的临时状态，符合"点开看一眼、
     翻页/重进就恢复收起"的克制交互，不喧宾夺主地常驻展示原文 ---- */
  function buildRecallRow(msg, isMe, myName, session) {
    var row = document.createElement('div');
    row.className = 'crm-sys-row' + (isMe ? ' is-me' : '');
    row.setAttribute('data-msg-ts', String(msg.ts));
    row.setAttribute('data-msg-from', msg.from);

    /* 归边容器：撤回印 + 引线 + 原文卡横向并排。对方（默认）DOM 顺序
       为 撤回印→引线→原文卡，天然靠左展开在右；我方靠 CSS 的
       row-reverse 整体镜像，视觉顺序变为 原文卡→引线→撤回印，
       让原文卡出现在撤回印的左边，同时整组靠右站位 */
    var stack = document.createElement('div');
    stack.className = 'crm-sys-recall-stack';

    var pill = document.createElement('div');
    pill.className = 'crm-sys-recall';
    pill.setAttribute('role', 'button');
    pill.setAttribute('tabindex', '0');

    var glyph = document.createElement('span');
    glyph.className = 'crm-sys-recall-glyph';
    glyph.setAttribute('aria-hidden', 'true');
    var shade = document.createElement('span');
    shade.className = 'crm-sys-recall-glyph-shade';
    glyph.appendChild(shade);

    var text = document.createElement('span');
    text.className = 'crm-sys-recall-text';
    var who = isMe ? (myName || '我') : (session.name || '对方');
    text.textContent = who + '撤回了一条消息';

    var hint = document.createElement('span');
    hint.className = 'crm-sys-recall-hint';
    hint.textContent = 'RECALLED';

    var caret = document.createElement('span');
    caret.className = 'crm-sys-recall-caret';
    caret.setAttribute('aria-hidden', 'true');
    caret.innerHTML = iconRecallCaret();

    pill.appendChild(glyph);
    pill.appendChild(text);
    pill.appendChild(hint);
    pill.appendChild(caret);

    var thread = document.createElement('span');
    thread.className = 'crm-sys-recall-thread';
    thread.setAttribute('aria-hidden', 'true');

    var reveal = document.createElement('div');
    reveal.className = 'crm-recall-reveal';
    var card = document.createElement('div');
    card.className = 'crm-recall-reveal-card';
    var label = document.createElement('span');
    label.className = 'crm-recall-reveal-label';
    label.textContent = 'ORIGINAL MESSAGE';
    var body = document.createElement('span');
    body.textContent = msg.text || '（无内容）';
    card.appendChild(label);
    card.appendChild(body);
    reveal.appendChild(card);

    var toggle = function () {
      var open = reveal.classList.toggle('is-open');
      pill.classList.toggle('is-open', open);
      stack.classList.toggle('is-open', open);
    };
    pill.addEventListener('click', function (evt) { evt.stopPropagation(); toggle(); });
    pill.addEventListener('keydown', function (evt) {
      if (evt.key === 'Enter' || evt.key === ' ') { evt.preventDefault(); toggle(); }
    });

    stack.appendChild(pill);
    stack.appendChild(thread);
    stack.appendChild(reveal);
    row.appendChild(stack);
    return row;
  }

  /* ==========================================================================
     多选模式 —— 状态机 + 顶栏/底部操作条绑定 + 批量删除/转发/截图
     —— 设计取舍：多选态下仍然复用主消息区 DOM（不重新渲染成另一套
        列表），只是给已经存在的每一行气泡挂一枚勾选环、给顶栏/输入栏
        切换成专属版本——这样进入/退出多选不会有任何消息区闪烁重排，
        用户当前的滚动位置也原样保留。
     —— mselState 只保存"被选中的消息标识集合"（ts+from 组合 key）
        与最近一次交互带来的 ctx（storeKey/session/renderAll 等），
        不缓存消息正文本身：批量操作时统一重新从 LunaDB 读一次最新
        列表，按 key 过滤，保证拿到的是当下最新、未被其它标签页
        修改过的数据。
  ========================================================================== */
  var mselState = null; // { picked: Map<key, {ts,from}>, ctx }

  function mselKey(msg) { return msg.from + ':' + msg.ts; }

  function isMultiSelectOn() { return !!mselState; }

  function getMselTopEls() {
    return {
      bar: document.getElementById('crmMselTopBar'),
      cancelBtn: document.getElementById('crmMselCancelBtn'),
      countEl: document.getElementById('crmMselCount'),
      allBtn: document.getElementById('crmMselAllBtn')
    };
  }
  function getMselActionEls() {
    return {
      bar: document.getElementById('crmMselActionBar'),
      shotBtn: document.getElementById('crmMselScreenshotBtn'),
      fwdBtn: document.getElementById('crmMselForwardBtn'),
      delBtn: document.getElementById('crmMselDeleteBtn')
    };
  }

  var mselBound = false;
  function bindMselOnce() {
    if (mselBound) return;
    mselBound = true;
    var t = getMselTopEls();
    var a = getMselActionEls();
    if (t.cancelBtn) t.cancelBtn.addEventListener('click', function () { exitMultiSelect(); });
    if (t.allBtn) t.allBtn.addEventListener('click', toggleMselAll);
    if (a.shotBtn) a.shotBtn.addEventListener('click', openScreenshotFromSelection);
    if (a.fwdBtn) a.fwdBtn.addEventListener('click', openForwardFromSelection);
    if (a.delBtn) a.delBtn.addEventListener('click', openBatchDeleteModal);
  }

  /* ---- 进入多选：由气泡长按菜单「多选」项或长按气泡触发，
     首个被点中的消息立即置为已选，与其余 IM 的交互习惯一致 ---- */
  function enterMultiSelect(ctx, firstMsg, firstCheckEl) {
    bindMselOnce();
    mselState = { picked: new Map(), ctx: ctx };
    document.body.setAttribute('data-crm-msel', 'on');
    var t = getMselTopEls();
    if (t.bar) requestAnimationFrame(function () { t.bar.classList.add('is-open'); });
    if (firstMsg) {
      mselState.picked.set(mselKey(firstMsg), firstMsg);
      if (firstCheckEl) firstCheckEl.classList.add('is-picked');
    }
    updateMselChrome();
  }

  function exitMultiSelect() {
    if (!mselState) return;
    mselState = null;
    document.body.removeAttribute('data-crm-msel');
    var t = getMselTopEls();
    if (t.bar) t.bar.classList.remove('is-open');
    document.querySelectorAll('.crm-msel-check.is-picked').forEach(function (n) {
      n.classList.remove('is-picked');
    });
  }

  function toggleMselPick(msg, checkEl, ctx) {
    if (!mselState) {
      enterMultiSelect(ctx, msg, checkEl);
      return;
    }
    mselState.ctx = ctx || mselState.ctx;
    var key = mselKey(msg);
    if (mselState.picked.has(key)) {
      mselState.picked.delete(key);
      if (checkEl) checkEl.classList.remove('is-picked');
    } else {
      mselState.picked.set(key, msg);
      if (checkEl) checkEl.classList.add('is-picked');
    }
    updateMselChrome();
  }

  function toggleMselAll() {
    if (!mselState) return;
    var rows = document.querySelectorAll('.crm-msel-row[data-msg-ts]');
    var totalSelectable = 0;
    rows.forEach(function (r) { if (!r.querySelector('.crm-msel-check')) return; totalSelectable++; });
    var allPicked = totalSelectable > 0 && mselState.picked.size >= totalSelectable;

    if (allPicked) {
      mselState.picked.clear();
      document.querySelectorAll('.crm-msel-check.is-picked').forEach(function (n) { n.classList.remove('is-picked'); });
    } else {
      // 全选：需要重新从当前渲染的 DOM 读取每一行对应的原始 msg 对象——
      // 简化做法是重新拉取一次最新消息列表，按 ts+from 建索引后逐条勾上
      var ctx = mselState.ctx;
      if (ctx && ctx.loadMessages && ctx.storeKey) {
        ctx.loadMessages(ctx.storeKey).then(function (list) {
          (list || []).forEach(function (m) { mselState.picked.set(mselKey(m), m); });
          document.querySelectorAll('.crm-msel-check').forEach(function (n) { n.classList.add('is-picked'); });
          updateMselChrome();
        });
        return;
      }
    }
    updateMselChrome();
  }

  function updateMselChrome() {
    if (!mselState) return;
    var n = mselState.picked.size;
    var t = getMselTopEls();
    var a = getMselActionEls();
    if (t.countEl) t.countEl.textContent = String(n);
    if (t.allBtn) {
      var rows = document.querySelectorAll('.crm-msel-check').length;
      t.allBtn.textContent = (rows > 0 && n >= rows) ? '取消全选' : '全选';
      t.allBtn.classList.toggle('is-all', rows > 0 && n >= rows);
    }
    [a.shotBtn, a.fwdBtn, a.delBtn].forEach(function (btn) {
      if (btn) btn.disabled = n === 0;
    });
  }

  /* ---- 长按气泡：触屏端直接进入多选并勾上当前这条，桌面端（无
     touch 事件）不触发，仍走长按菜单里的「多选」入口 ---- */
  function bindLongPressToMultiSelect(bubbleEl, msg, ctx, checkEl) {
    var pressTimer = null;
    var LONG_PRESS_MS = 480;
    function start() {
      clearTimeout(pressTimer);
      pressTimer = setTimeout(function () {
        if (isMultiSelectOn()) return; // 已在多选中，交给普通 tap 逻辑处理
        closeSelectMenu(true);
        enterMultiSelect(ctx, msg, checkEl);
      }, LONG_PRESS_MS);
    }
    function cancel() { clearTimeout(pressTimer); }
    bubbleEl.addEventListener('touchstart', start, { passive: true });
    bubbleEl.addEventListener('touchend', cancel);
    bubbleEl.addEventListener('touchmove', cancel);
    bubbleEl.addEventListener('touchcancel', cancel);
  }

  /* ---- 批量删除：复用「删除确认弹窗」同一套居中磨砂白玉语言，
     独立的一份 DOM（crmMselDel*），预览区改为"共 N 条消息"摘要 ---- */
  function getMselDelEls() {
    return {
      mask: document.getElementById('crmMselDelMask'),
      modal: document.getElementById('crmMselDelModal'),
      preview: document.getElementById('crmMselDelPreview'),
      cancelBtn: document.getElementById('crmMselDelCancelBtn'),
      confirmBtn: document.getElementById('crmMselDelConfirmBtn')
    };
  }
  var mselDelBound = false;
  function bindMselDelOnce() {
    if (mselDelBound) return;
    mselDelBound = true;
    var e = getMselDelEls();
    if (!e.mask || !e.modal) return;
    e.mask.addEventListener('click', closeBatchDeleteModal);
    e.cancelBtn.addEventListener('click', closeBatchDeleteModal);
    e.confirmBtn.addEventListener('click', confirmBatchDelete);
  }

  function openBatchDeleteModal() {
    if (!mselState || mselState.picked.size === 0) return;
    bindMselDelOnce();
    var e = getMselDelEls();
    if (!e.mask || !e.modal) return;
    e.preview.className = 'crm-del-preview is-summary';
    e.preview.innerHTML = '<span class="crm-del-summary-num">' + mselState.picked.size + '</span><span>&nbsp;条消息</span>';
    e.confirmBtn.disabled = false;
    e.mask.classList.add('is-open');
    e.modal.classList.add('is-open');
    e.mask.setAttribute('aria-hidden', 'false');
    e.modal.setAttribute('aria-hidden', 'false');
  }
  function closeBatchDeleteModal() {
    var e = getMselDelEls();
    if (!e.mask || !e.modal) return;
    e.mask.classList.remove('is-open');
    e.modal.classList.remove('is-open');
    e.mask.setAttribute('aria-hidden', 'true');
    e.modal.setAttribute('aria-hidden', 'true');
  }
  function confirmBatchDelete() {
    if (!mselState) { closeBatchDeleteModal(); return; }
    var e = getMselDelEls();
    var ctx = mselState.ctx;
    var pickedKeys = new Set(mselState.picked.keys());
    if (!ctx || !ctx.loadMessages || !ctx.saveMessages) { closeBatchDeleteModal(); return; }

    e.confirmBtn.disabled = true;
    ctx.loadMessages(ctx.storeKey).then(function (list) {
      list = list || [];
      var kept = list.filter(function (m) { return !pickedKeys.has(mselKey(m)); });
      return ctx.saveMessages(ctx.storeKey, kept).then(function () { return kept; });
    }).then(function (kept) {
      if (ctx.els && ctx.session && ctx.renderAll) ctx.renderAll(kept, ctx.els, ctx.session);
      if (window.LunaMessagesBus) window.LunaMessagesBus.notify();
      closeBatchDeleteModal();
      exitMultiSelect();
      showFlashToast('已删除');
    }).catch(function () {
      e.confirmBtn.disabled = false;
      showFlashToast('删除失败，请重试');
    });
  }

  /* ---- 批量转发：复用现有「转发给」好友选择页 + 确认弹窗，
     区别只在于发送阶段——把所有选中消息打包成一条
     msg.bundle = { items: [{from, text, ts}, ...] } 的合并消息，
     而不是逐条各发一条。选中消息按原始时间顺序（ts 升序）排列，
     与消息区里出现的先后一致。 ---- */
  function openForwardFromSelection() {
    if (!mselState || mselState.picked.size === 0) return;
    var ctx = mselState.ctx;
    var items = Array.from(mselState.picked.values()).sort(function (a, b) { return a.ts - b.ts; });

    bindFwdPickerOnce();
    var els = getFwdPickerEls();
    if (!els.page) return;

    // 单条选中时退化为普通单条转发（与长按菜单里的「转发」体验一致）；
    // 多条时走合并转发（bundle），沿用同一套选择好友 UI，仅内部标记不同
    if (items.length === 1) {
      closeSelectMenu(true);
      openForwardPicker(items[0], items[0].from === 'me', ctx);
      return;
    }

    forwardState = { bundleItems: items, isMe: true, ctx: ctx, picked: new Map() };
    els.previewWho.textContent = '聊天记录';
    els.previewText.textContent = '共 ' + items.length + ' 条消息';
    els.searchInput.value = '';
    updateFwdConfirmBar();
    loadFwdFriendsAndRender();

    els.veil.classList.add('is-open');
    els.page.classList.add('is-open');
    els.veil.setAttribute('aria-hidden', 'false');
    els.page.setAttribute('aria-hidden', 'false');
  }

  /* ---- 截图：把选中消息（按 ts 升序）交给离屏渲染管线合成一张
     长图，完成后打开截图预览页展示 ---- */
  function openScreenshotFromSelection() {
    if (!mselState || mselState.picked.size === 0) return;
    var ctx = mselState.ctx;
    var items = Array.from(mselState.picked.values()).sort(function (a, b) { return a.ts - b.ts; });
    openScreenshotPreview(items, ctx);
  }

  /* ==========================================================================
     聊天记录详情页 —— 点击合并转发卡片后打开，只读复刻被打包的
     那几条消息（头像/气泡/时间/日期徽记一律照旧渲染），不提供任何
     长按菜单/多选/编辑入口。与截图预览页共用顶栏骨架。
  ========================================================================== */
  function getBundleEls() {
    return {
      veil: document.getElementById('crmBundleVeil'),
      page: document.getElementById('crmBundlePage'),
      backBtn: document.getElementById('crmBundleBackBtn'),
      titleCn: document.getElementById('crmBundleTitleCn'),
      scroll: document.getElementById('crmBundleScroll')
    };
  }
  var bundleBound = false;
  function bindBundleOnce() {
    if (bundleBound) return;
    bundleBound = true;
    var e = getBundleEls();
    if (!e.page) return;
    e.backBtn.addEventListener('click', closeBundleDetail);
    e.veil.addEventListener('click', closeBundleDetail);
  }

  function openBundleDetail(bundle, isMe, ctx) {
    bindBundleOnce();
    var e = getBundleEls();
    if (!e.page) return;
    var items = bundle.items || [];
    e.titleCn.textContent = '聊天记录（' + items.length + '）';
    e.scroll.innerHTML = '';
    renderReadonlyThread(items, e.scroll, ctx);

    e.veil.classList.add('is-open');
    e.page.classList.add('is-open');
    e.veil.setAttribute('aria-hidden', 'false');
    e.page.setAttribute('aria-hidden', 'false');
  }
  function closeBundleDetail() {
    var e = getBundleEls();
    if (!e.page) return;
    e.veil.classList.remove('is-open');
    e.page.classList.remove('is-open');
    e.veil.setAttribute('aria-hidden', 'true');
    e.page.setAttribute('aria-hidden', 'true');
  }

  /* ---- 只读渲染一串消息到任意容器：截图/聊天记录详情页共用，
     结构上完整复刻主消息区（日期徽记 + 头像 + 气泡串），但不挂
     任何交互（长按菜单/多选/引用跳转全部省略），纯展示 ---- */
  function renderReadonlyThread(items, container, ctx) {
    if (!items || !items.length) return;
    var session = (ctx && ctx.session) || {};
    var myName = (ctx && ctx.myName) || '我';
    var lastDateKey = null;

    items.forEach(function (msg) {
      var d = new Date(msg.ts);
      var dateKey = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
      if (dateKey !== lastDateKey) {
        container.appendChild(buildReadonlyDateSeal(d));
        lastDateKey = dateKey;
      }
      container.appendChild(buildReadonlyRow(msg, session, myName));
    });
  }

  function buildReadonlyDateSeal(d) {
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

  function buildReadonlyRow(msg, session, myName) {
    var isMe = msg.from === 'me';
    var group = document.createElement('div');
    group.className = 'crm-msg-group' + (isMe ? ' is-me' : '');

    var avatarWrap = document.createElement('div');
    avatarWrap.className = 'crm-msg-avatar-wrap';
    var avatar = document.createElement('div');
    avatar.className = 'crm-msg-avatar';
    var glyph = document.createElement('span');
    glyph.className = 'crm-msg-avatar-glyph';
    glyph.textContent = isMe ? (myName || '我').charAt(0) : (session.name || '?').charAt(0);
    avatar.appendChild(glyph);
    avatarWrap.appendChild(avatar);

    var col = document.createElement('div');
    col.className = 'crm-msg-col';
    var stream = document.createElement('div');
    stream.className = 'crm-bubble-stream';

    var bubble = document.createElement('div');
    bubble.className = 'crm-bubble is-first is-last';
    var inner = document.createElement('div');
    inner.className = 'crm-bubble-inner';
    if (msg.forward) inner.appendChild(buildReadonlyForwardTag(msg.forward));
    if (msg.bundle) {
      var mini = document.createElement('div');
      mini.className = 'crm-bundle-card';
      var head = document.createElement('div');
      head.className = 'crm-bundle-card-head';
      var title = document.createElement('span');
      title.className = 'crm-bundle-card-title';
      title.textContent = '[聊天记录]';
      head.appendChild(title);
      mini.appendChild(head);
      inner.appendChild(mini);
    } else {
      var textEl = document.createElement('div');
      textEl.className = 'crm-bubble-text';
      textEl.textContent = msg.text || '';
      inner.appendChild(textEl);
    }
    bubble.appendChild(inner);
    bubble.style.setProperty('--crm-stream-h', '0px');

    var time = document.createElement('div');
    time.className = 'crm-msg-time';
    time.textContent = formatAmPm(new Date(msg.ts));

    var wrap = document.createElement('div');
    wrap.className = 'crm-bubble-wrap';
    wrap.appendChild(bubble);
    wrap.appendChild(time);
    stream.appendChild(wrap);

    col.appendChild(stream);
    group.appendChild(avatarWrap);
    group.appendChild(col);
    return group;
  }

  function buildReadonlyForwardTag(fwd) {
    var tag = document.createElement('div');
    tag.className = 'crm-fwd-tag';
    var text = document.createElement('span');
    text.className = 'crm-fwd-tag-text';
    text.textContent = '转发自 ' + (fwd.fromName || '好友');
    tag.appendChild(text);
    return tag;
  }

  /* ==========================================================================
     长截图生成 —— 离屏合成一张位图（背景 + 逐条气泡），
     不使用任何第三方库：用 SVG <foreignObject> 包裹一份真实 HTML
     结构，序列化后经 Image 解码、绘制进 <canvas>，再导出为 PNG——
     这样背景层（含聊天壁纸）与气泡漆面渐变都会被"拍"进最终位图，
     不是简单同步复制 DOM 节点了事，效果等同于系统截图。
  ========================================================================== */
  function getShotEls() {
    return {
      veil: document.getElementById('crmShotVeil'),
      page: document.getElementById('crmShotPage'),
      backBtn: document.getElementById('crmShotBackBtn'),
      loading: document.getElementById('crmShotLoading'),
      scroll: document.getElementById('crmShotScroll'),
      img: document.getElementById('crmShotImg'),
      bottomBar: document.getElementById('crmShotBottomBar'),
      saveBtn: document.getElementById('crmShotSaveBtn')
    };
  }
  var shotBound = false;
  var shotGeneratedUrl = null;
  function bindShotOnce() {
    if (shotBound) return;
    shotBound = true;
    var e = getShotEls();
    if (!e.page) return;
    e.backBtn.addEventListener('click', closeScreenshotPreview);
    e.veil.addEventListener('click', closeScreenshotPreview);
    e.saveBtn.addEventListener('click', saveScreenshotToAlbum);
  }

  function openScreenshotPreview(items, ctx) {
    bindShotOnce();
    var e = getShotEls();
    if (!e.page) return;

    e.img.hidden = true;
    e.img.removeAttribute('src');
    e.loading.hidden = false;
    e.saveBtn.disabled = true;
    if (shotGeneratedUrl) { URL.revokeObjectURL(shotGeneratedUrl); shotGeneratedUrl = null; }

    e.veil.classList.add('is-open');
    e.page.classList.add('is-open');
    e.veil.setAttribute('aria-hidden', 'false');
    e.page.setAttribute('aria-hidden', 'false');

    renderScreenshotBitmap(items, ctx).then(function (dataUrl) {
      e.img.src = dataUrl;
      e.img.hidden = false;
      e.loading.hidden = true;
      e.saveBtn.disabled = false;
    }).catch(function () {
      e.loading.hidden = true;
      showFlashToast('截图生成失败，请重试');
    });
  }
  function closeScreenshotPreview() {
    var e = getShotEls();
    if (!e.page) return;
    e.veil.classList.remove('is-open');
    e.page.classList.remove('is-open');
    e.veil.setAttribute('aria-hidden', 'true');
    e.page.setAttribute('aria-hidden', 'true');
  }
  /* ---- 保存到相册：占位实现——当前先触发浏览器下载，后续接入
     真实"相册 App"后，把这里换成写入相册 App 自己的存储即可，
     不需要改动截图生成与预览逻辑 ---- */
  function saveScreenshotToAlbum() {
    var e = getShotEls();
    if (!e.img || !e.img.src) return;
    var a = document.createElement('a');
    a.href = e.img.src;
    a.download = 'luna-chat-' + Date.now() + '.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showFlashToast('已保存到相册');
  }

  function escXml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---- 核心合成：不再走 SVG <foreignObject> + Image 解码这条路——
     iOS/WebKit 会把任何内含 foreignObject 的 SVG 图像判定为"跨域内容"，
     哪怕全部是本地生成、零外部资源，一样会把 canvas 标记为 tainted，
     调用 toDataURL() 时必抛 SecurityError（Chrome 不受影响，但这是
     iOS WebView 应用，必须兼容 Safari 的这条限制）。改为完全用
     Canvas 2D 原生 API（fillRect/圆角路径/fillText）逐条手工绘制气泡，
     不产生任何"图像"，天然不会被判定为污染源。
     换行处理：canvas fillText 不会自动换行，这里按气泡最大宽度做
     字符级换行（中文/日文/韩文按单字符断行；ASCII 连续字母数字视为
     一个"单词"整体换行，避免把英文单词从中间截断）。 ---- */
  function measureWrappedLines(cx, text, maxWidth) {
    var lines = [];
    var paragraphs = String(text == null ? '' : text).split('\n');
    paragraphs.forEach(function (para) {
      if (para === '') { lines.push(''); return; }
      // 先把整段拆成"词元"：连续的 ASCII 字母/数字/常见符号算一个词元
      // （不可从中间断开），其余字符（含中日韩标点）逐字符各自成词元。
      var tokens = para.match(/[A-Za-z0-9@_.\-']+|[^\x00-\x7F]|./g) || [];
      var cur = '';
      tokens.forEach(function (tok) {
        var trial = cur + tok;
        if (cur !== '' && cx.measureText(trial).width > maxWidth) {
          lines.push(cur);
          cur = tok.replace(/^\s+/, '');
        } else {
          cur = trial;
        }
      });
      lines.push(cur);
    });
    return lines;
  }

  function drawRoundedRect(cx, x, y, w, h, r) {
    cx.beginPath();
    cx.moveTo(x + r, y);
    cx.arcTo(x + w, y, x + w, y + h, r);
    cx.arcTo(x + w, y + h, x, y + h, r);
    cx.arcTo(x, y + h, x, y, r);
    cx.arcTo(x, y, x + w, y, r);
    cx.closePath();
  }

  /* ---- 把一个真实、同源的 <img>（背景图 / 头像图）安全地画进 canvas。
     只要图片本身是同源（本地 LunaDB 存的 base64/blob，不是远程跨域图），
     drawImage 就不会污染画布——真正会导致 toDataURL 报错的只有"跨域
     且无 CORS 头的远程图"和"foreignObject 里塞 HTML"这两种情况，
     直接画一张已经在页面上真实展示的 <img> 元素完全没问题。
     drawCover=true 时按 object-fit:cover 的规则居中裁切铺满目标框，
     否则按 object-fit:contain 居中留白。 ---- */
  function drawImageFit(cx, img, dx, dy, dw, dh, drawCover) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    var srcRatio = iw / ih, dstRatio = dw / dh;
    var sx, sy, sw, sh;
    if (drawCover ? (srcRatio > dstRatio) : (srcRatio < dstRatio)) {
      sh = ih; sw = ih * dstRatio; sx = (iw - sw) / 2; sy = 0;
    } else {
      sw = iw; sh = iw / dstRatio; sx = 0; sy = (ih - sh) / 2;
    }
    if (drawCover) {
      cx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    } else {
      // contain：整图完整塞进目标框，居中留白
      var scale2 = Math.min(dw / iw, dh / ih);
      var ow = iw * scale2, oh = ih * scale2;
      cx.drawImage(img, 0, 0, iw, ih, dx + (dw - ow) / 2, dy + (dh - oh) / 2, ow, oh);
    }
  }

  /* ---- 头部信息条：真实还原顶栏——头像（真实图片或纯色首字母占位，
     与 applyPeerHeader 的逻辑保持一致）+ 昵称 + 在线状态 ---- */
  function drawRealHeader(cx, els, session, x, y, w) {
    var AV = 34, AV_GAP = 10;
    var avatarImgEl = els && els.peerAvatar ? els.peerAvatar.querySelector('img') : null;
    var cxCenter = x + AV / 2, cyCenter = y + AV / 2;

    cx.save();
    cx.beginPath();
    cx.arc(cxCenter, cyCenter, AV / 2, 0, Math.PI * 2);
    cx.clip();
    if (avatarImgEl && avatarImgEl.complete && avatarImgEl.naturalWidth) {
      drawImageFit(cx, avatarImgEl, x, y, AV, AV, true);
    } else {
      var colorKey = (session && session.color) || 'ink';
      var col = COLOR_MAP[colorKey] || COLOR_MAP.ink;
      cx.fillStyle = col.avBg;
      cx.fillRect(x, y, AV, AV);
      cx.fillStyle = col.avCol;
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.font = '600 15px "PingFang SC","Microsoft YaHei",sans-serif';
      cx.fillText(((session && session.name) || '?').charAt(0), cxCenter, cyCenter + 1);
    }
    cx.restore();

    var tx = x + AV + AV_GAP;
    cx.textAlign = 'left';
    cx.textBaseline = 'alphabetic';
    cx.fillStyle = '#f1f1f3';
    cx.font = '600 14.5px "PingFang SC","Microsoft YaHei",sans-serif';
    cx.fillText((session && session.name) || '好友', tx, cyCenter - 1);
    cx.fillStyle = 'rgba(241,241,243,0.55)';
    cx.font = '400 10.5px "PingFang SC","Microsoft YaHei",sans-serif';
    cx.fillText((session && session.online) ? '在线 · ONLINE' : '离线 · OFFLINE', tx, cyCenter + 13);

    return AV + 14; // 头部条总高度（含上下留白）
  }

  /* ---- 气泡区域：直接从当前页面里已经真实渲染出来的气泡节点
     （data-msg-ts + data-msg-from 能唯一定位）克隆一份，原样保留
     所有 class 与内联样式（含 --crm-stream-h/--crm-stream-y 这类
     内联自定义属性），装进一个结构对齐 .crm-msg-group/.crm-bubble-stream
     的离屏容器——这样气泡的多层渐变、漆面反光、高光条、缝合线、
     box-shadow 全部是真实 CSS 算出来的，不需要我们再猜一次数值。
     再把这个离屏容器序列化进 SVG <foreignObject>，交给 Image 解码后
     用 drawImage 画进主 canvas。
     —— 已知代价：iOS/WebKit 只要 SVG 里出现 foreignObject，就会把
     整张画布判定为"内容不透明、来源不可信"而标记为 tainted，届时
     canvas.toDataURL() 会抛 SecurityError——不论内容是不是本地生成、
     区域多小都一样，这是引擎级限制不是我们代码能绕开的。所以这里
     显式做了降级：一旦这条路径失败，自动回退到上一版手绘气泡
     （drawBubblesHandDrawn），保证截图功能本身始终可用，只是退化
     成外观近似版，而不是直接报错。 ---- */
  function buildRealBubbleListClone(items, ctx) {
    var els = ctx && ctx.els;
    var listRoot = els && els.scrollInner ? els.scrollInner : document;
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;flex-direction:column;gap:16px;';

    items.forEach(function (msg) {
      var real = listRoot.querySelector(
        '.crm-bubble[data-msg-ts="' + CSS.escape(String(msg.ts)) + '"][data-msg-from="' + CSS.escape(String(msg.from)) + '"]'
      );
      if (!real) return; // 极端情况下（比如消息在截图过程中被删）跳过这一条，不让整体失败
      var isMe = msg.from === 'me';

      var group = document.createElement('div');
      group.className = 'crm-msg-group' + (isMe ? ' is-me' : '');
      group.style.cssText = 'display:flex;' + (isMe ? 'justify-content:flex-end;' : 'justify-content:flex-start;');

      var col = document.createElement('div');
      col.className = 'crm-msg-col';
      col.style.cssText = 'display:flex;flex-direction:column;' + (isMe ? 'align-items:flex-end;' : 'align-items:flex-start;');

      var nameEl = document.createElement('div');
      nameEl.textContent = isMe ? ((ctx && ctx.myName) || '我') : ((ctx && ctx.session && ctx.session.name) || '好友');
      nameEl.style.cssText = 'font-size:10.5px;font-weight:600;color:#8a8a90;margin:0 4px 5px;';

      var wrap = document.createElement('div');
      wrap.className = 'crm-bubble-wrap';

      var clone = real.cloneNode(true);
      // 截图不需要多选态的勾选环，克隆时去掉，避免圆圈也被一起截进去
      var check = clone.parentNode && clone.parentNode.querySelector
        ? null : null; // 真实节点是 .crm-bubble 本身，勾选环在其父 .crm-msel-row 里，不会被 cloneNode(true) 带进来

      wrap.appendChild(clone);
      col.appendChild(nameEl);
      col.appendChild(wrap);
      group.appendChild(col);
      wrapper.appendChild(group);
    });

    return wrapper;
  }

  function captureRealBubblesToImage(items, ctx, width) {
    return new Promise(function (resolve, reject) {
      var clone = buildRealBubbleListClone(items, ctx);
      var srcWrap = document.createElement('div');
      srcWrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:' + width + 'px;pointer-events:none;z-index:-1;';
      srcWrap.appendChild(clone);
      document.body.appendChild(srcWrap);

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          try {
            var h = Math.max(clone.scrollHeight || clone.offsetHeight, 1);
            var xhtml = '<div xmlns="http://www.w3.org/1999/xhtml" style="font-family:\'PingFang SC\',\'Microsoft YaHei\',sans-serif;">' + clone.outerHTML + '</div>';
            var svg =
              '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + h + '">' +
                '<foreignObject x="0" y="0" width="' + width + '" height="' + h + '">' + xhtml + '</foreignObject>' +
              '</svg>';
            var svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
            var url = URL.createObjectURL(svgBlob);
            var img = new Image();
            img.onload = function () {
              URL.revokeObjectURL(url);
              document.body.removeChild(srcWrap);
              resolve({ img: img, height: h });
            };
            img.onerror = function (err) {
              URL.revokeObjectURL(url);
              if (srcWrap.parentNode) document.body.removeChild(srcWrap);
              reject(err);
            };
            img.src = url;
          } catch (err) {
            if (srcWrap.parentNode) document.body.removeChild(srcWrap);
            reject(err);
          }
        });
      });
    });
  }

  function renderScreenshotBitmap(items, ctx) {
    var CSS_W = 360;
    var scale = Math.min(2, window.devicePixelRatio || 1.5);
    var session = (ctx && ctx.session) || {};
    var myName = (ctx && ctx.myName) || '我';
    var els = ctx && ctx.els;
    var FONT_STACK = '"PingFang SC","Microsoft YaHei",sans-serif';

    // 读取真实背景层的当前状态（图/视频当前帧、蒙层深浅），全部来自
    // 页面上此刻正在展示的真实 DOM，不是另起一份配置去猜。
    var bgImgEl = els && els.bgImg && !els.bgImg.hidden ? els.bgImg : null;
    var bgVideoEl = els && els.bgVideo && !els.bgVideo.hidden ? els.bgVideo : null;
    var bgIsContain = !!((bgImgEl && bgImgEl.classList.contains('is-contain')) || (bgVideoEl && bgVideoEl.classList.contains('is-contain')));
    var scrimBg = els && els.bgScrim ? els.bgScrim.style.background : '';
    var scrimMatch = /rgba?\([^)]+\)/.exec(scrimBg || '');
    var scrimColor = scrimMatch ? scrimMatch[0] : null;

    var HEADER_PAD_X = 20, HEADER_TOP = 16;

    var PAD_X = 22;
    var BUBBLE_MAX_W = Math.round((CSS_W - PAD_X * 2) * 0.78);
    var BUBBLE_PAD_X = 16;
    var BUBBLE_PAD_TOP = 12;
    var BUBBLE_PAD_BOTTOM = 13;
    var LINE_H = 13.5 * 1.55;
    var NAME_H = 10.5 + 5;
    var GAP = 16;
    var RADIUS = 22;

    // 用一个离屏测量 canvas 先把每条消息按文字排好版、算出总高度，
    // 真正绘制时复用同一份排版结果，避免测量和绘制用了不同字号取整误差。
    var measureCanvas = document.createElement('canvas');
    var mcx = measureCanvas.getContext('2d');

    var laidOut = items.map(function (msg) {
      var isMe = msg.from === 'me';
      var who = isMe ? myName : (session.name || '好友');
      var isBundle = !!msg.bundle;
      var bodyText = isBundle
        ? ('[聊天记录 · 共' + (msg.bundle.items ? msg.bundle.items.length : 0) + '条]')
        : (msg.text || '');
      var fwdName = msg.forward ? (msg.forward.fromName || '好友') : null;

      mcx.font = (isBundle ? '700 12.5px ' : '400 13.5px ') + FONT_STACK;
      var bodyLines = measureWrappedLines(mcx, bodyText, BUBBLE_MAX_W - BUBBLE_PAD_X * 2);

      var fwdLines = [];
      if (fwdName) {
        mcx.font = '600 10.5px ' + FONT_STACK;
        fwdLines = measureWrappedLines(mcx, '转发自 ' + fwdName, BUBBLE_MAX_W - BUBBLE_PAD_X * 2);
      }

      var bubbleContentH = bodyLines.length * LINE_H;
      var fwdBlockH = fwdLines.length ? (fwdLines.length * (10.5 * 1.4) + 6 + 6) : 0;
      var bubbleH = BUBBLE_PAD_TOP + fwdBlockH + bubbleContentH + BUBBLE_PAD_BOTTOM;

      mcx.font = '400 13.5px ' + FONT_STACK;
      var widestBody = 0;
      bodyLines.forEach(function (l) { widestBody = Math.max(widestBody, mcx.measureText(l).width); });
      mcx.font = '700 12.5px ' + FONT_STACK;
      if (isBundle) bodyLines.forEach(function (l) { widestBody = Math.max(widestBody, mcx.measureText(l).width); });
      mcx.font = '600 10.5px ' + FONT_STACK;
      var widestFwd = 0;
      fwdLines.forEach(function (l) { widestFwd = Math.max(widestFwd, mcx.measureText(l).width); });
      var bubbleW = Math.min(BUBBLE_MAX_W, Math.max(widestBody, widestFwd) + BUBBLE_PAD_X * 2);
      bubbleW = Math.max(bubbleW, 44); // 极短内容也留个最小宽度，别缩成一个点

      return {
        isMe: isMe, who: who, isBundle: isBundle,
        bodyLines: bodyLines, fwdLines: fwdLines,
        bubbleW: bubbleW, bubbleH: bubbleH,
        rowH: NAME_H + bubbleH + GAP
      };
    });

    var HEADER_H = HEADER_TOP + 34 + 16; // 头像 34px + 上下留白
    var MARK_H = 13 + 18 + 14 + 1; // “LUNA 月鉴”标记区（放在头部条下方，而非最顶）
    var FOOTER_H = 14 + 18 + 1 + 14; // 底部日期条
    var TOP_PAD = 0, BOTTOM_PAD = 22;
    var listH = laidOut.reduce(function (sum, r) { return sum + r.rowH; }, 0);
    var handDrawnH = Math.max(TOP_PAD + HEADER_H + MARK_H + listH + FOOTER_H + BOTTOM_PAD, 40);

    var LIST_W = CSS_W - PAD_X * 2;

    function drawBackgroundHeaderMark(cx, W, H, onDark) {
      cx.fillStyle = '#fdfdfe';
      cx.fillRect(0, 0, W, H);
      if (bgImgEl && bgImgEl.complete && bgImgEl.naturalWidth) {
        drawImageFit(cx, bgImgEl, 0, 0, W, H, !bgIsContain);
      } else if (bgVideoEl && bgVideoEl.readyState >= 2 && bgVideoEl.videoWidth) {
        drawImageFit(cx, bgVideoEl, 0, 0, W, H, !bgIsContain);
      } else {
        var grad = cx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W * 0.9);
        grad.addColorStop(0, 'rgba(150,160,190,0.08)');
        grad.addColorStop(1, 'rgba(150,160,190,0)');
        cx.fillStyle = grad;
        cx.fillRect(0, 0, W, H);
      }
      if (scrimColor) {
        cx.fillStyle = scrimColor;
        cx.fillRect(0, 0, W, H);
      }

      cx.save();
      var headerGrad = cx.createLinearGradient(0, 0, 0, HEADER_H);
      headerGrad.addColorStop(0, 'rgba(10,10,12,0.55)');
      headerGrad.addColorStop(1, 'rgba(10,10,12,0.15)');
      cx.fillStyle = headerGrad;
      cx.fillRect(0, 0, W, HEADER_H);
      drawRealHeader(cx, els, session, HEADER_PAD_X, HEADER_TOP, W - HEADER_PAD_X * 2);
      cx.restore();

      var y = HEADER_H;
      cx.textAlign = 'center';
      cx.textBaseline = 'alphabetic';
      cx.fillStyle = onDark ? '#f1f1f3' : '#141416';
      cx.font = '700 13px "Noto Serif KR","Playfair Display",serif';
      cx.fillText('LUNA 月鉴', W / 2, y + 13);
      cx.fillStyle = onDark ? 'rgba(241,241,243,0.6)' : '#8a8a90';
      cx.font = '400 8px "Space Mono",monospace';
      cx.fillText('CHAT SNAPSHOT', W / 2, y + 13 + 14);
      y += 13 + 14 + 8;
      cx.strokeStyle = onDark ? 'rgba(241,241,243,0.2)' : 'rgba(18,18,26,0.1)';
      cx.lineWidth = 1;
      cx.beginPath();
      cx.moveTo(PAD_X, y);
      cx.lineTo(W - PAD_X, y);
      cx.stroke();
      y += 18 - 8;
      return y;
    }

    function drawFooter(cx, W, y, onDark) {
      y += FOOTER_H - 14 - 18 - 1 - 14;
      cx.strokeStyle = onDark ? 'rgba(241,241,243,0.2)' : 'rgba(18,18,26,0.1)';
      cx.beginPath();
      cx.moveTo(PAD_X + 2, y + 14);
      cx.lineTo(W - PAD_X - 2, y + 14);
      cx.stroke();
      cx.textAlign = 'center';
      cx.fillStyle = onDark ? 'rgba(241,241,243,0.6)' : '#8a8a90';
      cx.font = '400 11px ' + FONT_STACK;
      cx.fillText(formatFullDate(new Date()), W / 2, y + 14 + 18);
    }

    function drawBubblesHandDrawn(cx, y, onDark) {
      laidOut.forEach(function (row) {
        var bx = row.isMe ? (CSS_W - PAD_X - row.bubbleW) : PAD_X;
        var nameX = row.isMe ? (CSS_W - PAD_X) : PAD_X;

        cx.textAlign = row.isMe ? 'right' : 'left';
        cx.fillStyle = onDark ? 'rgba(241,241,243,0.65)' : '#8a8a90';
        cx.font = '600 10.5px ' + FONT_STACK;
        cx.fillText(row.who, nameX, y + 10.5);
        y += NAME_H;

        if (row.isMe) {
          var g2 = cx.createLinearGradient(bx, y, bx, y + row.bubbleH);
          g2.addColorStop(0, '#232329'); g2.addColorStop(0.62, '#16161a'); g2.addColorStop(1, '#0a0a0c');
          cx.fillStyle = g2;
        } else {
          var g3 = cx.createLinearGradient(bx, y, bx, y + row.bubbleH);
          g3.addColorStop(0, '#ffffff'); g3.addColorStop(1, '#f7f7f9');
          cx.fillStyle = g3;
        }
        if (onDark) {
          cx.save();
          cx.shadowColor = 'rgba(0,0,0,0.28)';
          cx.shadowBlur = 10;
          cx.shadowOffsetY = 3;
        }
        drawRoundedRect(cx, bx, y, row.bubbleW, row.bubbleH, RADIUS);
        cx.fill();
        if (onDark) cx.restore();
        if (!row.isMe) {
          cx.strokeStyle = 'rgba(18,18,26,0.08)';
          cx.lineWidth = 1;
          drawRoundedRect(cx, bx, y, row.bubbleW, row.bubbleH, RADIUS);
          cx.stroke();
        }

        var ty = y + BUBBLE_PAD_TOP;
        cx.textAlign = 'left';
        if (row.fwdLines.length) {
          cx.fillStyle = row.isMe ? 'rgba(245,245,247,0.42)' : 'rgba(20,20,22,0.42)';
          cx.font = '600 10.5px ' + FONT_STACK;
          row.fwdLines.forEach(function (l) {
            ty += 10.5 * 1.4;
            cx.fillText(l, bx + BUBBLE_PAD_X, ty);
          });
          ty += 6;
          cx.strokeStyle = row.isMe ? 'rgba(245,245,247,0.15)' : 'rgba(18,18,26,0.1)';
          cx.beginPath();
          cx.moveTo(bx + BUBBLE_PAD_X, ty);
          cx.lineTo(bx + row.bubbleW - BUBBLE_PAD_X, ty);
          cx.stroke();
          ty += 6;
        }
        cx.fillStyle = row.isMe ? '#f5f5f7' : '#141416';
        cx.font = (row.isBundle ? '700 12.5px ' : '400 13.5px ') + FONT_STACK;
        row.bodyLines.forEach(function (l) {
          ty += LINE_H;
          cx.fillText(l, bx + BUBBLE_PAD_X, ty - (LINE_H - 13.5) * 0.3);
        });

        y += row.bubbleH + GAP;
      });
      return y;
    }

    function composeFinal(bubbleImg, bubbleH) {
      var H = bubbleImg
        ? Math.max(TOP_PAD + HEADER_H + MARK_H + bubbleH + FOOTER_H + BOTTOM_PAD, 40)
        : handDrawnH;
      var canvas = document.createElement('canvas');
      canvas.width = CSS_W * scale;
      canvas.height = H * scale;
      var cx = canvas.getContext('2d');
      cx.scale(scale, scale);

      var hasBgMedia = !!((bgImgEl && bgImgEl.complete && bgImgEl.naturalWidth) || (bgVideoEl && bgVideoEl.readyState >= 2 && bgVideoEl.videoWidth));
      var onDark = hasBgMedia;

      var y = drawBackgroundHeaderMark(cx, CSS_W, H, onDark);
      if (bubbleImg) {
        cx.drawImage(bubbleImg, PAD_X, y, LIST_W, bubbleH);
        y += bubbleH + 6;
      } else {
        y = drawBubblesHandDrawn(cx, y, onDark);
      }
      drawFooter(cx, CSS_W, y, onDark);

      return canvas.toDataURL('image/png');
    }

    return captureRealBubblesToImage(items, ctx, LIST_W).then(function (result) {
      try {
        return composeFinal(result.img, result.height);
      } catch (err) {
        // drawImage 那一步没问题，但最终 toDataURL 时画布仍被判污染——
        // 退回手绘气泡再合成一次
        return composeFinal(null, 0);
      }
    }).catch(function () {
      // 真实 DOM 抓取/序列化/解码本身失败（含 iOS 对 foreignObject 的
      // canvas 污染限制），整体退回手绘气泡版本，保证功能始终可用
      try {
        return composeFinal(null, 0);
      } catch (err2) {
        return Promise.reject(err2);
      }
    });
  }

  /* ==========================================================================
     转发功能 —— 「转发给」好友选择页 + 确认弹窗 + 落盘发送
     数据来源：window.LunaFriends.uniqueFriends()，与好友页/消息页
     完全同源，好友页新增/编辑好友后本功能无需任何额外同步代码。
     —— 转发只做一件事：把这条消息的文字，作为一条新消息写入被选中
        好友各自的会话记录（'chatroom:' + storeKey 约定），并标记
        msg.forward = { fromName } 供渲染时显示"转发自 谁"。
     —— 明确不触发任何自动回复：这里只调用 loadMessages/saveMessages
        直接落盘，不调用页面里请求 AI 回复的那一套逻辑，被转发到的
        会话里，除这条转发消息本身外不会凭空多出别的内容。
     —— 若被转发的正是当前打开的这个会话（转发给自己正在聊的这位
        好友），发送后立即重新渲染当前消息区，让新气泡马上可见；
        广播 LunaMessagesBus，好友页/消息页的最新预览随之同步。 ---- */
  var forwardState = null; // { msg, isMe, ctx, picked: Map<key, friend> }

  function forwardFriendKey(f) {
    return f.charId != null ? ('c:' + f.charId) : ('n:' + f.name);
  }
  function forwardStoreKeyForFriend(f) {
    return 'chatroom:' + (f.charId != null ? ('char-' + f.charId) : ('name-' + f.name));
  }

  function getFwdPickerEls() {
    return {
      veil: document.getElementById('crmFwdVeil'),
      page: document.getElementById('crmFwdPage'),
      backBtn: document.getElementById('crmFwdBackBtn'),
      previewWho: document.getElementById('crmFwdPreviewWho'),
      previewText: document.getElementById('crmFwdPreviewText'),
      searchInput: document.getElementById('crmFwdSearchInput'),
      loading: document.getElementById('crmFwdLoading'),
      list: document.getElementById('crmFwdList'),
      empty: document.getElementById('crmFwdEmpty'),
      confirmBar: document.getElementById('crmFwdConfirmBar'),
      confirmBtn: document.getElementById('crmFwdConfirmBtn'),
      confirmText: document.getElementById('crmFwdConfirmText')
    };
  }
  function getFwdConfirmEls() {
    return {
      mask: document.getElementById('crmFwdConfirmMask'),
      modal: document.getElementById('crmFwdConfirmModal'),
      preview: document.getElementById('crmFwdConfirmPreview'),
      targets: document.getElementById('crmFwdConfirmTargets'),
      cancelBtn: document.getElementById('crmFwdConfirmCancelBtn'),
      sendBtn: document.getElementById('crmFwdConfirmSendBtn')
    };
  }

  function fwdEscHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  var fwdAllFriends = [];

  function buildFwdRow(f) {
    var row = document.createElement('button');
    row.type = 'button';
    row.className = 'crm-fwd-row';
    row.setAttribute('data-online', f.online ? 'true' : 'false');
    var key = forwardFriendKey(f);
    row.dataset.key = key;

    var avatar = document.createElement('div');
    avatar.className = 'crm-fwd-avatar';
    if (f.avatar) {
      var img = document.createElement('img');
      img.src = f.avatar;
      img.alt = '';
      avatar.appendChild(img);
    } else {
      var letter = document.createElement('span');
      letter.className = 'crm-fwd-avatar-letter';
      letter.textContent = (f.name || '?').charAt(0).toUpperCase();
      avatar.appendChild(letter);
    }
    var statusDot = document.createElement('span');
    statusDot.className = 'crm-fwd-status-dot';
    statusDot.setAttribute('aria-hidden', 'true');
    avatar.appendChild(statusDot);

    var body = document.createElement('div');
    body.className = 'crm-fwd-row-body';
    var name = document.createElement('div');
    name.className = 'crm-fwd-row-name';
    name.textContent = f.name || '未命名好友';
    body.appendChild(name);
    if (f.note) {
      var note = document.createElement('div');
      note.className = 'crm-fwd-row-note';
      note.textContent = f.note;
      body.appendChild(note);
    }

    var check = document.createElement('span');
    check.className = 'crm-fwd-check';
    check.setAttribute('aria-hidden', 'true');
    check.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12.5L10 17.5L19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    row.appendChild(avatar);
    row.appendChild(body);
    row.appendChild(check);

    row.addEventListener('click', function () {
      if (!forwardState) return;
      var picked = forwardState.picked;
      if (picked.has(key)) {
        picked.delete(key);
        row.classList.remove('is-picked');
      } else {
        picked.set(key, f);
        row.classList.add('is-picked');
      }
      updateFwdConfirmBar();
    });

    return row;
  }

  function renderFwdList(filterText) {
    var els = getFwdPickerEls();
    if (!els.list) return;
    var q = (filterText || '').trim().toLowerCase();
    var filtered = !q ? fwdAllFriends : fwdAllFriends.filter(function (f) {
      return (f.name || '').toLowerCase().indexOf(q) !== -1;
    });

    els.list.innerHTML = '';
    filtered.forEach(function (f) {
      var row = buildFwdRow(f);
      if (forwardState && forwardState.picked.has(forwardFriendKey(f))) row.classList.add('is-picked');
      els.list.appendChild(row);
    });

    var hasAny = fwdAllFriends.length > 0;
    els.loading.style.display = 'none';
    els.empty.style.display = hasAny ? 'none' : 'flex';
    els.list.style.display = hasAny ? 'flex' : 'none';
  }

  /* ---- 好友数据可能仍在从数据库异步读取——好友页 chat.js 里的
     GROUPS 要等 LunaDB.get('friendGroups') 回调触发才会真正填充，
     首次读库完成后会广播一次 luna:friends-changed。这里不能只读
     一次就把"读到空数组"当成"确实没有好友"：数据库读取尚未完成
     时先展示加载态，并订阅这个事件，一旦好友数据到手立即补渲染，
     不需要用户关闭重开这个页面 ---- */
  var fwdFriendsListenerBound = false;
  function loadFwdFriendsAndRender() {
    var els = getFwdPickerEls();
    var known = (window.LunaFriends && window.LunaFriends.uniqueFriends) ? window.LunaFriends.uniqueFriends() : [];
    var alreadyLoaded = !!(window.LunaFriends && window.LunaFriends.isLoaded && window.LunaFriends.isLoaded());

    if (known.length > 0 || alreadyLoaded) {
      // 已经确定读库完成（不论有没有好友），直接按真实结果渲染
      fwdAllFriends = known;
      renderFwdList(els.searchInput ? els.searchInput.value : '');
      return;
    }

    // 读库很可能仍在进行中：先展示加载态，不要过早判定为空态
    fwdAllFriends = [];
    if (els.loading) els.loading.style.display = 'flex';
    if (els.list) els.list.style.display = 'none';
    if (els.empty) els.empty.style.display = 'none';

    if (!fwdFriendsListenerBound) {
      fwdFriendsListenerBound = true;
      document.addEventListener('luna:friends-changed', function () {
        // 只在转发页仍然打开时才重新渲染，避免页面关闭后台无谓刷新
        if (!forwardState) return;
        var els2 = getFwdPickerEls();
        fwdAllFriends = (window.LunaFriends && window.LunaFriends.uniqueFriends) ? window.LunaFriends.uniqueFriends() : [];
        renderFwdList(els2.searchInput ? els2.searchInput.value : '');
      });
    }

    // 兜底：若数据库确实为空（比如从未添加过好友），luna:friends-changed
    // 仍会在读库完成的那一刻广播一次（哪怕结果是空数组），上面的监听器
    // 已经能接住这种情况——这里不再需要额外的超时兜底逻辑。
  }

  function updateFwdConfirmBar() {
    var els = getFwdPickerEls();
    if (!forwardState || !els.confirmBar) return;
    var n = forwardState.picked.size;
    els.confirmBar.classList.toggle('is-ready', n > 0);
    els.confirmText.textContent = n > 0 ? ('发送给 ' + n + ' 位好友') : '发送';
  }

  var fwdPickerBound = false;
  function bindFwdPickerOnce() {
    if (fwdPickerBound) return;
    fwdPickerBound = true;
    var els = getFwdPickerEls();
    if (!els.page) return;

    els.backBtn.addEventListener('click', closeForwardPicker);
    els.veil.addEventListener('click', closeForwardPicker);
    els.searchInput.addEventListener('input', function () {
      renderFwdList(els.searchInput.value);
    });
    els.confirmBtn.addEventListener('click', function () {
      if (!forwardState || forwardState.picked.size === 0) return;
      openForwardConfirm();
    });
    document.addEventListener('keydown', function (evt) {
      if (evt.key !== 'Escape') return;
      if (forwardConfirmState) { closeForwardConfirm(); return; }
      if (forwardState) closeForwardPicker();
    });
  }

  function openForwardPicker(msg, isMe, ctx) {
    bindFwdPickerOnce();
    var els = getFwdPickerEls();
    if (!els.page) return;
    if (!msg.text) { showFlashToast('这条消息暂不支持转发'); return; }

    forwardState = { msg: msg, isMe: isMe, ctx: ctx, picked: new Map() };

    els.previewWho.textContent = isMe ? (ctx.myName || '我') : (ctx.session && ctx.session.name ? ctx.session.name : '好友');
    els.previewText.textContent = msg.text;
    els.searchInput.value = '';
    updateFwdConfirmBar();

    loadFwdFriendsAndRender();

    els.veil.classList.add('is-open');
    els.page.classList.add('is-open');
    els.veil.setAttribute('aria-hidden', 'false');
    els.page.setAttribute('aria-hidden', 'false');
  }

  function closeForwardPicker() {
    if (!forwardState) return;
    forwardState = null;
    var els = getFwdPickerEls();
    if (!els.page) return;
    els.veil.classList.remove('is-open');
    els.page.classList.remove('is-open');
    els.veil.setAttribute('aria-hidden', 'true');
    els.page.setAttribute('aria-hidden', 'true');
  }

  /* ---- 确认弹窗：与修改/删除弹窗同一套居中磨砂白玉语言，
     禁止使用浏览器原生 confirm()，一律走这套自绘弹窗 ---- */
  var forwardConfirmState = null; // { picked: [{key, friend}] }
  var fwdConfirmBound = false;
  function bindFwdConfirmOnce() {
    if (fwdConfirmBound) return;
    fwdConfirmBound = true;
    var e = getFwdConfirmEls();
    if (!e.mask || !e.modal) return;
    e.mask.addEventListener('click', closeForwardConfirm);
    e.cancelBtn.addEventListener('click', closeForwardConfirm);
    e.sendBtn.addEventListener('click', sendForward);
  }

  function openForwardConfirm() {
    bindFwdConfirmOnce();
    if (!forwardState) return;
    var e = getFwdConfirmEls();
    if (!e.mask || !e.modal) return;

    var pickedList = [];
    forwardState.picked.forEach(function (f, key) { pickedList.push({ key: key, friend: f }); });
    forwardConfirmState = { pickedList: pickedList };

    if (forwardState.bundleItems) {
      e.preview.textContent = '聊天记录 · 共 ' + forwardState.bundleItems.length + ' 条消息';
    } else {
      e.preview.textContent = forwardState.msg.text || '';
    }
    e.targets.innerHTML = '';
    pickedList.forEach(function (p) {
      var chip = document.createElement('span');
      chip.className = 'crm-fwd-target-chip';
      chip.textContent = p.friend.name || '未命名好友';
      e.targets.appendChild(chip);
    });

    e.sendBtn.disabled = false;
    e.mask.classList.add('is-open');
    e.modal.classList.add('is-open');
    e.mask.setAttribute('aria-hidden', 'false');
    e.modal.setAttribute('aria-hidden', 'false');
  }

  function closeForwardConfirm() {
    if (!forwardConfirmState) return;
    forwardConfirmState = null;
    var e = getFwdConfirmEls();
    if (!e.mask || !e.modal) return;
    e.mask.classList.remove('is-open');
    e.modal.classList.remove('is-open');
    e.mask.setAttribute('aria-hidden', 'true');
    e.modal.setAttribute('aria-hidden', 'true');
  }

  /* ---- 实际发送：逐个目标好友会话追加一条新消息。
     单条转发：字段与普通发送消息一致（from/text/ts），额外带上
     forward 标记；批量转发（bundleItems 存在时）：只追加一条
     msg.bundle = { items } 的合并消息，接收方渲染成"聊天记录"卡片。
     两条路径都绝不触发任何"生成 AI 回复"的调用——纯粹落盘 + 渲染 ---- */
  function sendForward() {
    if (!forwardState || !forwardConfirmState) return;
    var e = getFwdConfirmEls();
    var st = forwardState;
    var targets = forwardConfirmState.pickedList;
    if (!targets.length) { closeForwardConfirm(); return; }

    e.sendBtn.disabled = true;

    var fromName = st.isMe ? (st.ctx.myName || '我') : (st.ctx.session && st.ctx.session.name ? st.ctx.session.name : '好友');
    var currentStoreKey = st.ctx && st.ctx.storeKey;
    var isBundle = !!st.bundleItems;

    var tasks = targets.map(function (t) {
      var f = t.friend;
      var targetStoreKey = forwardStoreKeyForFriend(f);
      var newMsg = isBundle
        ? {
            from: 'me',
            text: '',
            ts: Date.now() + Math.random(),
            bundle: { items: st.bundleItems.map(function (m) {
              return { from: m.from, text: m.text || '', ts: m.ts, forward: m.forward, bundle: m.bundle };
            }) }
          }
        : {
            from: 'me',
            text: st.msg.text || '',
            ts: Date.now() + Math.random(), // 避免同毫秒并发写入时时间戳完全重复
            forward: { fromName: fromName }
          };
      return loadMessages(targetStoreKey).then(function (list) {
        list = list || [];
        list.push(newMsg);
        return saveMessages(targetStoreKey, list).then(function () {
          return { targetStoreKey: targetStoreKey, list: list };
        });
      });
    });

    Promise.all(tasks).then(function (results) {
      // 若转发目标恰好包含当前正打开的这个会话，立即重渲染让新气泡可见
      results.forEach(function (r) {
        if (currentStoreKey && r.targetStoreKey === currentStoreKey && st.ctx.renderAll && st.ctx.els && st.ctx.session) {
          st.ctx.renderAll(r.list, st.ctx.els, st.ctx.session);
          if (st.ctx.scrollToBottom) st.ctx.scrollToBottom(st.ctx.els, true);
        }
      });
      if (window.LunaMessagesBus) window.LunaMessagesBus.notify();
      closeForwardConfirm();
      closeForwardPicker();
      exitMultiSelect();
      showFlashToast(targets.length > 1 ? ('已转发给 ' + targets.length + ' 位好友') : '已转发');
    }).catch(function () {
      e.sendBtn.disabled = false;
      showFlashToast('转发失败，请重试');
    });
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
  /* 撤回印右侧的折线指示——比原先随图标旋转 180° 更克制，只用一枚
     小巧的月牙形折线提示"可点开/收起"，颜色与撤回印月光色系同源 */
  function iconRecallCaret() {
    return '<svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M5 9L12 15.5L19 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
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
     禁止自我暴露 AI 身份等既有开关。deletedNotes 非空时额外插入一段
     "被删线索"，让模型知道自己刚才有话被用户删掉了 ---- */
  function buildSystemPrompt(charRecord, session, worldSection, userIdentity, myName, deletedNotes, quotableIndex, quoteAllowed, recallAllowed) {
    var parts = [];
    parts.push(buildCharPersonaBlock(charRecord, session));
    if (worldSection) parts.push(worldSection);
    parts.push(buildUserPersonaBlock(userIdentity, myName));
    var deletedSection = buildDeletedNotesSection(deletedNotes);
    if (deletedSection) parts.push(deletedSection);
    var quoteSection = buildQuotableIndexPromptSection(quotableIndex, quoteAllowed);
    if (quoteSection) parts.push(quoteSection);
    var recallSection = buildRecallPromptSection(recallAllowed);
    if (recallSection) parts.push(recallSection);

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

  /* ---- 拼装"被删线索"区块：把最近几条被用户删除的 AI 消息原文
     列出来，明确告知这不是负面评价、也不需要道歉或反复提起，
     而是一个悄悄内化的信号——接下来自然调整语气/内容/贴合人设
     程度即可，不要在回复里主动提"你删了我的消息"这类话，那样
     反而显得刻意和 OOC ---- */
  function buildDeletedNotesSection(deletedNotes) {
    if (!deletedNotes || !deletedNotes.length) return '';
    var lines = [];
    lines.push('【重要背景信号 —— 仅供你internal参考，绝不能在回复里提及或点破】');
    lines.push('你刚才作为角色说过的以下这' + deletedNotes.length + '句话，被用户直接从聊天记录里删除了：');
    deletedNotes.forEach(function (n, i) {
      var text = (n && n.text || '').trim();
      if (text.length > 80) text = text.slice(0, 80) + '…';
      lines.push((i + 1) + '. ' + text);
    });
    lines.push('用户删掉这些话，通常意味着内容让 ta 觉得多余、答非所问、突然乱码/重复、或者不符合角色人设、让人出戏。');
    lines.push('你需要把这当成一次隐性的反馈来悄悄调整这次回复：可以换一个更贴合人设的语气、避免重复类似的内容或结构、把话说得更简洁自然。');
    lines.push('绝对不要在回复里提到"消息被删"这件事本身，也不要道歉或解释，正常自然地继续对话即可，只是要在语气与内容上有所收敛调整。');
    return lines.join('\n');
  }

  /* ---- 组装发给 API 的 messages：system + 最近历史（映射 from:'me'→user，
     from:'peer'→assistant）。历史条数超过上限时只取最近一段，
     避免 prompt 无限增长。
     —— 已撤回的消息不计入上下文：撤回的本质是"说话人自己反悔收回"，
     对话继续往下走时不该把这句已被收回的话当成仍然生效的发言去
     延续，否则模型会顺着一句自己"没说过"（在对话语境里）的话
     继续接话，显得前后矛盾——这与已删除消息不进入 buildChatMessages
     是同一套道理 ---- */
  function buildChatMessages(systemPrompt, history, myName) {
    var msgs = [{ role: 'system', content: systemPrompt }];
    var trimmed = (history || []).slice(-AI_CONTEXT_LIMIT).filter(function (m) { return !m.recalled; });
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

  /* ==========================================================================
     AI 引用能力 —— 让角色也能像真人一样"翻回去接住某一句"，
     但绝不是每条回复都引用（那样会显得刻意、破坏聊天的自然感）。
     两层约束叠加：
     ① Prompt 层——明确告诉模型"这次是否允许引用"，允许时也只是
        "可以、非必须"，并给出使用场景（呼应更早之前的某句话、
        迟来的反应、纠正自己刚才没接住的点等），不允许时干脆不给
        标记语法说明，降低误用概率；
     ② 代码层——用一个简单的会话级节流器兜底：无论 prompt 有没有
        管住模型，只有节流器判定"这次轮到你可以引用了"的那一轮，
        才会真的把 [[quote:N]] 解析成引用，其余情况一律原样剥除
        标记当普通文字处理，从机制上保证引用不会被滥用成每条都带。
  ========================================================================== */
  var QUOTE_MIN_GAP_TURNS = 1;   // 距离上一次成功引用，至少要隔这么多次 AI 生成轮次
  var QUOTE_BASE_CHANCE = 0.55;  // 满足间隔条件后，这一轮仍只有这个概率真正允许引用

  function quoteStateKey(storeKey) { return 'chatroomQuoteState:' + storeKey; }

  function loadQuoteState(storeKey) {
    if (window.LunaDB) {
      return window.LunaDB.get(quoteStateKey(storeKey)).then(function (v) {
        return v || { turnsSinceQuote: QUOTE_MIN_GAP_TURNS };
      });
    }
    return Promise.resolve({ turnsSinceQuote: QUOTE_MIN_GAP_TURNS });
  }
  function saveQuoteState(storeKey, state) {
    if (window.LunaDB) return window.LunaDB.set(quoteStateKey(storeKey), state);
    return Promise.resolve(false);
  }

  /* 判定这一轮 AI 生成是否允许真正触发引用：先看是否已经过了最小
     间隔轮数，过了才按概率掷一次骰子——两道门槛叠加，天然做出
     "偶尔为之、绝不连续、更绝不每次"的节奏，且不需要模型自己
     判断"我是不是引用太频繁了"这种它其实做不好的事 ---- */
  function isQuoteTurnAllowed(storeKey) {
    return loadQuoteState(storeKey).then(function (state) {
      var turnsSince = (state && state.turnsSinceQuote) || 0;
      if (turnsSince < QUOTE_MIN_GAP_TURNS) return false;
      return Math.random() < QUOTE_BASE_CHANCE;
    });
  }
  /* 每一轮生成结束后调用：如果这一轮真的用掉了引用名额，清零计数；
     否则计数 +1，为下一次判定累积间隔 ---- */
  function markQuoteTurnUsed(storeKey) {
    return saveQuoteState(storeKey, { turnsSinceQuote: 0 });
  }
  function bumpQuoteTurnCounter(storeKey) {
    return loadQuoteState(storeKey).then(function (state) {
      var turnsSince = (state && state.turnsSinceQuote) || 0;
      return saveQuoteState(storeKey, { turnsSinceQuote: turnsSince + 1 });
    });
  }

  /* ---- 组装可供模型引用的「最近消息索引」：取最近若干条历史，
     编号 1..N，附上简短发送方标签与截断后的原文，写进 system
     prompt。索引与真实消息之间用 ts+from 建立映射，之后解析
     [[quote:N]] 时据此还原出真正的 { ts, from, text } ---- */
  var QUOTABLE_WINDOW = 12;
  function buildQuotableIndex(history) {
    var recent = (history || []).slice(-QUOTABLE_WINDOW);
    return recent.map(function (m, i) {
      var text = (m.text || '').trim();
      if (text.length > 40) text = text.slice(0, 40) + '…';
      return { n: i + 1, from: m.from, ts: m.ts, text: text };
    });
  }
  function buildQuotableIndexPromptSection(quotableIndex, quoteAllowed) {
    if (!quoteAllowed || !quotableIndex || !quotableIndex.length) return '';
    var lines = [];
    lines.push('【本轮可引用的最近消息 —— 仅这一轮生效】');
    quotableIndex.forEach(function (item) {
      var who = item.from === 'me' ? '对方(用户)' : '你自己之前说过';
      lines.push(item.n + '. [' + who + '] ' + item.text);
    });
    lines.push('系统已经判定这一轮适合用一次引用（"不能每次都引用"这条约束由系统在轮次层面控制，不需要你自己再刻意克制），所以只要上面列表里有一条内容适合被回头接住、呼应或纠正，就请在这次要发的其中一条短句最前面加上 [[quote:编号]] 标记来引用它，编号对应上面列表，标记只能出现在这次输出里的其中一条短句开头，且最多出现一次。');
    lines.push('例如列表里第 2 条是对方说的话，你想呼应它，就把某一条短句写成：[[quote:2]]诶你刚说的那个');
    return lines.join('\n');
  }

  /* ---- 从一条模型输出的短句里解析 [[quote:N]] 标记：
     命中且编号在索引范围内时返回 { text, quote }（text 已去除标记，
     quote 是还原出的 { ts, from, text }）；未命中/编号非法则返回 null。
     标记理论上应该出现在短句最前面，但模型偶尔会在标记前多打一两个
     字符（语气词、标点），所以匹配时放宽到"标记出现在短句靠前的
     位置"而不是死板要求下标一定是 0，避免因为这种小偏差导致标记
     解析彻底失败、原始 [[quote:N]] 文本直接暴露给用户 ---- */
  var QUOTE_TAG_RE = /\[\[quote:(\d+)\]\]\s*/i;
  var QUOTE_TAG_RE_G = /\[\[quote:(\d+)\]\]\s*/gi;
  var QUOTE_TAG_LEADING_SLACK = 6; // 标记前最多容忍这么多个字符的"手滑"前缀
  function extractQuoteTag(seg, quotableIndex) {
    var m = QUOTE_TAG_RE.exec(seg);
    if (!m || m.index > QUOTE_TAG_LEADING_SLACK) return null;
    var n = parseInt(m[1], 10);
    var hit = (quotableIndex || []).filter(function (it) { return it.n === n; })[0];
    var prefix = seg.slice(0, m.index).trim();
    var rest = (prefix + ' ' + seg.slice(m.index + m[0].length)).trim();
    if (!hit || !rest) return null;
    return { text: rest, quote: { ts: hit.ts, from: hit.from, text: hit.text } };
  }
  /* 未获准引用的这一轮，或标记解析失败时的兜底：把标记本身（不论
     出现在句中哪个位置，哪怕出现多次）干净剥除，不生成引用，也
     绝不把 [[quote:N]] 原始标记文本暴露给用户 ---- */
  function stripQuoteTag(seg) {
    return seg.replace(QUOTE_TAG_RE_G, '').trim();
  }

  /* ==========================================================================
     AI 撤回能力 —— 让角色像真人一样偶尔"手滑发出去又反悔收回"，
     但绝不是每次回复都撤回（那样会显得刻意、破坏聊天的自然感，
     用户也会很快意识到这只是个固定套路而不是真实的犹豫）。
     与引用能力完全同构的两层约束：
     ① Prompt 层——只有 recallAllowed 为真的这一轮，才告诉模型
        "这次允许你撤回其中一条"，且明确这是"可以、非必须"，
        并给出恰当的使用场景（说错话/词不达意/情绪化发言后冷静/
        不小心说漏嘴），不允许时干脆不提这套语法，降低误用概率；
     ② 代码层——用一个独立的会话级节流器兜底：无论 prompt 有没有
        管住模型，只有节流器判定"这一轮轮到你可以撤回了"时，才会
        真的把 [[recall]] 解析成撤回动作，其余情况一律原样剥除
        标记当普通文字处理，从机制上保证撤回不会被滥用成每条都带，
        这正是"想清楚撤回功能的本质"里最关键的一环：撤回必须是
        偶发的、由语境触发的意外，而不是可预测的固定节奏。
  ========================================================================== */
  var RECALL_MIN_GAP_TURNS = 2;   // 距离上一次成功撤回，至少要隔这么多次 AI 生成轮次——比引用更稀疏，撤回是更少见的意外
  var RECALL_BASE_CHANCE = 0.22;  // 满足间隔条件后，这一轮仍只有这个概率真正允许撤回，保持"很少发生"的真实感

  function recallStateKey(storeKey) { return 'chatroomRecallState:' + storeKey; }

  function loadRecallState(storeKey) {
    if (window.LunaDB) {
      return window.LunaDB.get(recallStateKey(storeKey)).then(function (v) {
        return v || { turnsSinceRecall: RECALL_MIN_GAP_TURNS };
      });
    }
    return Promise.resolve({ turnsSinceRecall: RECALL_MIN_GAP_TURNS });
  }
  function saveRecallState(storeKey, state) {
    if (window.LunaDB) return window.LunaDB.set(recallStateKey(storeKey), state);
    return Promise.resolve(false);
  }

  /* 判定这一轮 AI 生成是否允许真正触发撤回：与引用同一套"最小间隔 +
     概率骰子"两道门槛，天然做出"偶尔为之、绝不连续、更绝不每次"
     的节奏，且不依赖模型自己判断"我是不是撤回太频繁了" ---- */
  function isRecallTurnAllowed(storeKey) {
    return loadRecallState(storeKey).then(function (state) {
      var turnsSince = (state && state.turnsSinceRecall) || 0;
      if (turnsSince < RECALL_MIN_GAP_TURNS) return false;
      return Math.random() < RECALL_BASE_CHANCE;
    });
  }
  function markRecallTurnUsed(storeKey) {
    return saveRecallState(storeKey, { turnsSinceRecall: 0 });
  }
  function bumpRecallTurnCounter(storeKey) {
    return loadRecallState(storeKey).then(function (state) {
      var turnsSince = (state && state.turnsSinceRecall) || 0;
      return saveRecallState(storeKey, { turnsSinceRecall: turnsSince + 1 });
    });
  }

  /* ---- 撤回语法的 prompt 说明：仅在 recallAllowed 为真时才出现，
     给出具体的语境判断依据，让模型自己结合当前对话内容判断"这次
     是否真的适合撤回"，而不是机械地为了用而用——即便系统这一轮
     开放了名额，模型仍然完全可以选择不使用，名额只代表"这次用
     不算破坏节奏"，不是"这次必须用" ---- */
  function buildRecallPromptSection(recallAllowed) {
    if (!recallAllowed) return '';
    var lines = [];
    lines.push('【本轮可以撤回一条 —— 仅这一轮生效，且完全由你自行判断是否使用】');
    lines.push('系统已经判定这一轮偶尔撤回一次是合适的（"不能每次都撤回"这条约束由系统在轮次层面控制，你不需要刻意克制），但这只是"允许"，不是"必须"——大多数情况下你依然应该正常说话、完全不使用这个功能。');
    lines.push('只有当你接下来要说的某一条短句，结合当前语境确实很适合被"话说出口后又反悔收回"这种真实的犹豫感来演绎时——比如一时情绪化打了不该说的话、说漏嘴透露了不该说的信息、语气过重想收回、或者单纯口误说错了——才在那一条短句的最前面加上 [[recall]] 标记。');
    lines.push('标记只能出现在这次输出里的其中一条短句开头，且最多出现一次；带有该标记的这条短句内容仍然要正常写出完整的话（不要写"我要撤回了"这种描述撤回动作本身的话），系统会先把它正常发送出来，停顿一下后自动帮你处理成"撤回了一条消息"的效果，你不需要、也不应该在文字里自己描述"撤回"这个动作。');
    lines.push('例如：没事的|||[[recall]]其实我今天真的很难受|||你早点休息吧');
    lines.push('如果这次要说的话完全没有需要收回的理由，就不要使用这个标记，正常说话即可，不要为了凑效果而生硬地制造一个"该撤回"的话题。');
    return lines.join('\n');
  }

  /* ---- 从一条模型输出的短句里解析 [[recall]] 标记：命中时返回
     去除标记后的正文字符串；未命中返回 null。与引用标记同一套
     "标记前允许少量手滑前缀"的宽松匹配策略 ---- */
  var RECALL_TAG_RE = /\[\[recall\]\]\s*/i;
  var RECALL_TAG_RE_G = /\[\[recall\]\]\s*/gi;
  var RECALL_TAG_LEADING_SLACK = 6;
  function extractRecallTag(seg) {
    var m = RECALL_TAG_RE.exec(seg);
    if (!m || m.index > RECALL_TAG_LEADING_SLACK) return null;
    var prefix = seg.slice(0, m.index).trim();
    var rest = (prefix + ' ' + seg.slice(m.index + m[0].length)).trim();
    if (!rest) return null;
    return rest;
  }
  /* 未获准撤回的这一轮，或标记解析失败时的兜底：把标记本身干净
     剥除，绝不把 [[recall]] 原始标记文本暴露给用户 ---- */
  function stripRecallTag(seg) {
    return seg.replace(RECALL_TAG_RE_G, '').trim();
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