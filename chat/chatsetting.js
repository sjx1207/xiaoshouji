/* ==========================================================================
   Chat Setting — chatsetting.js
   聊天设置页交互逻辑：
   - 入口守卫：与聊天室共用同一份会话令牌（sessionStorage），
     直接以 URL 打开本页时展示拦截层
   - 背景数据持久化在 LunaDB（与 chatroom.js 共用同一个 IndexedDB 数据库），
     全局背景与「仅此角色」背景分别落在不同的 key 上，刷新/重开都不丢失：
       bgSetting:global        —— 全局背景，应用于所有未单独设置的聊天室
       bgSetting:char-<id>     —— 该角色专属背景（按 charId 精确匹配）
       bgSetting:name-<name>   —— 无 charId 时按昵称退化匹配
     图片/视频文件一律转为 dataURL 存入同一条记录，不依赖外部 blob URL，
     避免刷新后失效。
   - 网络链接：真实发起 HEAD/GET 探测 + Content-Type 校验，解析不出来的
     链接会给出明确报错，绝不假装解析成功。
   - 保存后通过 BroadcastChannel + localStorage 事件双通道通知，
     聊天室页面若在其它标签页打开也会实时同步背景。
========================================================================== */
(function () {
  'use strict';

  var SESSION_KEY = 'luna_chat_session';
  var BG_CHANNEL = 'luna_bg_channel';
  var BG_PING_KEY = 'luna_bg_ping';

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
      backBtn: document.getElementById('cstBackBtn'),
      peerLine: document.getElementById('cstPeerLine'),
      scroll: document.getElementById('cstScroll'),

      bondSeal: document.getElementById('cstBondSeal'),
      bondCharAvatar: document.getElementById('cstBondCharAvatar'),
      bondCharGlyph: document.getElementById('cstBondCharGlyph'),
      bondCharName: document.getElementById('cstBondCharName'),
      bondCharRole: document.getElementById('cstBondCharRole'),
      bondUserAvatar: document.getElementById('cstBondUserAvatar'),
      bondUserGlyph: document.getElementById('cstBondUserGlyph'),
      bondUserName: document.getElementById('cstBondUserName'),
      bondUserRole: document.getElementById('cstBondUserRole'),
      bondOrientFrom: document.getElementById('cstBondOrientFrom'),
      bondOrientTo: document.getElementById('cstBondOrientTo'),
      bondOrientValue: document.getElementById('cstBondOrientValue'),
      bondFactCallValue: document.getElementById('cstBondFactCallValue'),
      bondFactUserCallValue: document.getElementById('cstBondFactUserCallValue'),
      bondFactContextValue: document.getElementById('cstBondFactContextValue'),
      bondFactUserTagsValue: document.getElementById('cstBondFactUserTagsValue'),
      bondPicker: document.getElementById('cstBondPicker'),
      bondPickerTitle: document.getElementById('cstBondPickerTitle'),
      bondPickerList: document.getElementById('cstBondPickerList'),
      bondPickerNew: document.getElementById('cstBondPickerNew'),
      bondEmpty: document.getElementById('cstBondEmpty'),
      bondEmptyBtn: document.getElementById('cstBondEmptyBtn'),

      bondEditCharCall: document.getElementById('cstBondEditCharCall'),
      bondEditUserCall: document.getElementById('cstBondEditUserCall'),
      bondEditContext: document.getElementById('cstBondEditContext'),
      bondEditTags: document.getElementById('cstBondEditTags'),
      bondEditor: document.getElementById('cstBondEditor'),
      bondEditorTitle: document.getElementById('cstBondEditorTitle'),
      bondEditorHint: document.getElementById('cstBondEditorHint'),
      bondEditorClose: document.getElementById('cstBondEditorClose'),
      bondEditorInput: document.getElementById('cstBondEditorInput'),
      bondEditorTagsWrap: document.getElementById('cstBondEditorTagsWrap'),
      bondEditorChips: document.getElementById('cstBondEditorChips'),
      bondEditorTagInput: document.getElementById('cstBondEditorTagInput'),
      bondEditorChipAdd: document.getElementById('cstBondEditorChipAdd'),
      bondEditorCancel: document.getElementById('cstBondEditorCancel'),
      bondEditorSave: document.getElementById('cstBondEditorSave'),

      previewBg: document.getElementById('cstPreviewBg'),
      previewEmpty: document.getElementById('cstPreviewEmpty'),
      previewImg: document.getElementById('cstPreviewImg'),
      previewVideo: document.getElementById('cstPreviewVideo'),
      previewScrim: document.getElementById('cstPreviewScrim'),
      previewLabel: document.getElementById('cstPreviewLabel'),

      scopeGlobal: document.getElementById('cstScopeGlobal'),
      scopeChar: document.getElementById('cstScopeChar'),
      scopeHint: document.getElementById('cstScopeHint'),

      fileInput: document.getElementById('cstFileInput'),
      urlCard: document.getElementById('cstUrlCard'),
      urlPanel: document.getElementById('cstUrlPanel'),
      urlInput: document.getElementById('cstUrlInput'),
      urlGo: document.getElementById('cstUrlGo'),
      urlMsg: document.getElementById('cstUrlMsg'),

      fitRow: document.getElementById('cstFitRow'),
      dimSlider: document.getElementById('cstDimSlider'),

      resetBtn: document.getElementById('cstResetBtn'),
      saveBtn: document.getElementById('cstSaveBtn'),

      toast: document.getElementById('cstToast'),
      toastText: document.getElementById('cstToastText')
    };

    var charKey = 'bgSetting:' + (session.charId != null ? ('char-' + session.charId) : ('name-' + session.name));
    var globalKey = 'bgSetting:global';

    els.peerLine.textContent = '与「' + (session.name || '好友') + '」的专属设置';

    /* 当前编辑态：scope('global'|'char') + draft（本次待保存的背景配置） */
    var state = {
      scope: 'global',
      draft: { type: 'none', src: null, fit: 'cover', dim: 30 }
    };

    /* ---- 状态栏同步：与 chatroom.js 完全一致的读取方式 ---- */
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

    /* ---- 灵动岛同步：与 settings.js 的 applyIsland() 完全一致的渲染方式，
       读取 luna_island_enabled / luna_island_style，并监听 storage 的
       luna_island_update 广播，settings 页切换样式后本页实时跟着变 ---- */
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
          clock:   '<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="cstSiClockText">--:--</span></div></div>',
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
            var t = document.getElementById('cstSiClockText');
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

    /* ---- 羁绊印鉴：读取当前会话对应的角色档案 + 绑定的用户身份卡，
       解析方式与 chatroom.js 组装 AI 上下文时完全一致（同一套 charId 精确
       匹配 / 名字退化匹配、同一套 boundCharIds 绑定判定），
       确保这里展示给人看的关联关系与 AI 实际读到的关联关系是同一份数据。
       —— 只渲染关系性事实（姓名、定位、称呼、标签），
          不读取也不展示 prompt / backstory / personality 等人设正文字段。
       —— 未绑定时优先在卡内提供「选择已有身份直接绑定」，
          真正无身份可选时才引导跳转 user.html 创建。 ---- */
    if (els.bondSeal) {
      initBondSeal(els, session);
    }

    /* ---- 感知设置：地区 / 时间 / 天气双轨感应仪（user × char 分轨） ---- */
    initPerception(session);

    /* ---- 世界书感知：本聊天室生效条目（全局 / 仅此角色 两套启用集） ---- */
    initWorldbookLink(session);

    /* ---- 语音设置：本聊天室专属音色（全局 / 仅此角色 两套绑定） ---- */
    initVoiceLink(session);

    /* ---- 翻译设置：本聊天室消息双语呈现（全局 / 仅此角色 两套绑定） ---- */
    initTranslationLink(session);

    /* ---- 记录设置：聊天记录 / 通话记录 两枚跳转入口 ---- */
    initRecordLink(session);

    if (els.backBtn) {
      els.backBtn.addEventListener('click', function () {
        if (window.history.length > 1) window.history.back();
        else window.location.href = 'chatroom.html';
      });
    }

    /* ---- 作用范围切换：切换时载入该范围已保存的配置作为草稿起点 ---- */
    function setScope(scope) {
      state.scope = scope;
      els.scopeGlobal.classList.toggle('is-active', scope === 'global');
      els.scopeChar.classList.toggle('is-active', scope === 'char');
      els.scopeHint.textContent = scope === 'global'
        ? '应用于所有未单独设置的聊天室'
        : '仅应用于「' + (session.name || '这位好友') + '」的聊天室，优先于全局背景';
      loadDraftForScope(scope);
    }
    els.scopeGlobal.addEventListener('click', function () { setScope('global'); });
    els.scopeChar.addEventListener('click', function () { setScope('char'); });

    function keyForScope(scope) {
      return scope === 'char' ? charKey : globalKey;
    }

    function loadDraftForScope(scope) {
      dbGet(keyForScope(scope)).then(function (saved) {
        state.draft = saved ? cloneConfig(saved) : { type: 'none', src: null, fit: 'cover', dim: 30 };
        applyDraftToControls();
        renderPreview();
      });
    }

    function cloneConfig(cfg) {
      return { type: cfg.type, src: cfg.src, fit: cfg.fit || 'cover', dim: (typeof cfg.dim === 'number') ? cfg.dim : 30 };
    }

    function applyDraftToControls() {
      setFit(state.draft.fit || 'cover', false);
      els.dimSlider.value = state.draft.dim != null ? state.draft.dim : 30;
      updateSliderFill();
      if (state.draft.type === 'url') {
        els.urlInput.value = state.draft.src || '';
      }
    }

    /* ---- 显示方式：铺满 / 完整 ---- */
    function setFit(fit, rerender) {
      state.draft.fit = fit;
      var btns = els.fitRow.querySelectorAll('.cst-fit-btn');
      btns.forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-fit') === fit); });
      if (rerender !== false) renderPreview();
    }
    els.fitRow.addEventListener('click', function (evt) {
      var btn = evt.target.closest('.cst-fit-btn');
      if (!btn) return;
      setFit(btn.getAttribute('data-fit'), true);
    });

    /* ---- 遮罩强度滑杆 ---- */
    function updateSliderFill() {
      var pct = els.dimSlider.value;
      els.dimSlider.style.backgroundSize = pct + '% 100%';
    }
    els.dimSlider.addEventListener('input', function () {
      state.draft.dim = parseInt(els.dimSlider.value, 10);
      updateSliderFill();
      renderPreview();
    });

    /* ---- 本地上传：图片 / 视频 → dataURL，直接持久化进草稿 ---- */
    els.fileInput.addEventListener('change', function () {
      var file = els.fileInput.files && els.fileInput.files[0];
      if (!file) return;
      var isImage = file.type.indexOf('image/') === 0;
      var isVideo = file.type.indexOf('video/') === 0;
      if (!isImage && !isVideo) {
        showUrlMsg('仅支持图片或视频文件', true);
        return;
      }
      var MAX_BYTES = 40 * 1024 * 1024; // 40MB 上限，避免把 DB 撑爆
      if (file.size > MAX_BYTES) {
        showUrlMsg('文件过大，请选择 40MB 以内的文件', true);
        return;
      }
      closeUrlPanel();
      var reader = new FileReader();
      reader.onload = function () {
        state.draft.type = isImage ? 'image' : 'video';
        state.draft.src = reader.result;
        renderPreview();
      };
      reader.onerror = function () {
        showUrlMsg('文件读取失败，请重试', true);
      };
      reader.readAsDataURL(file);
      els.fileInput.value = '';
    });

    /* ---- 网络链接：展开输入区 ---- */
    els.urlCard.addEventListener('click', function () {
      var willOpen = !els.urlPanel.classList.contains('is-open');
      if (willOpen) openUrlPanel(); else closeUrlPanel();
    });
    function openUrlPanel() {
      els.urlPanel.classList.add('is-open');
      els.urlPanel.setAttribute('aria-hidden', 'false');
      els.urlCard.classList.add('is-active');
      setTimeout(function () { els.urlInput.focus(); }, 260);
    }
    function closeUrlPanel() {
      /* ---- 同样先移出焦点再隐藏，避免 aria-hidden 容器内仍有被聚焦
         的输入框（与羁绊印鉴编辑面板同一套修复方式） ---- */
      if (document.activeElement && els.urlPanel.contains(document.activeElement)) {
        document.activeElement.blur();
      }
      els.urlPanel.classList.remove('is-open');
      els.urlPanel.setAttribute('aria-hidden', 'true');
      els.urlCard.classList.remove('is-active');
    }

    function showUrlMsg(text, isError) {
      els.urlMsg.textContent = text;
      els.urlMsg.classList.toggle('is-error', !!isError);
      els.urlMsg.classList.toggle('is-ok', !isError);
    }

    var urlParsing = false;
    els.urlGo.addEventListener('click', function () { runUrlResolve(); });
    els.urlInput.addEventListener('keydown', function (evt) {
      if (evt.key === 'Enter') { evt.preventDefault(); runUrlResolve(); }
    });

    /* ---- URL 解析：真实发起网络请求校验，绝不无条件放行 ----
       流程：
       1) 基础格式校验（必须是合法 http/https 绝对地址）
       2) 优先按扩展名快速判定图片/视频类型
       3) 无法从扩展名判定时，发起 fetch 探测 Content-Type；
          图片走 <img> 的 load/error 事件兜底验证（部分跨域资源
          fetch 会被拒但 <img> 标签本身仍可加载显示），
          视频走 <video> 的 loadedmetadata/error 事件验证；
       4) 任何一步失败都给出明确报错文案，不会把解析不出来的
          链接悄悄当成"成功"处理。 ---- */
    function runUrlResolve() {
      if (urlParsing) return;
      var raw = els.urlInput.value.trim();
      if (!raw) { showUrlMsg('请先粘贴一个链接', true); return; }

      var parsed;
      try { parsed = new URL(raw); } catch (e) {
        showUrlMsg('链接格式不正确，请检查是否完整（需以 http/https 开头）', true);
        return;
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        showUrlMsg('仅支持 http / https 链接', true);
        return;
      }

      urlParsing = true;
      els.urlGo.disabled = true;
      els.urlGo.textContent = '解析中';
      showUrlMsg('正在解析链接……', false);

      resolveMediaType(parsed.href).then(function (kind) {
        state.draft.type = kind;
        state.draft.src = parsed.href;
        renderPreview();
        showUrlMsg(kind === 'video' ? '已识别为视频链接' : '已识别为图片链接', false);
      }).catch(function (err) {
        showUrlMsg((err && err.message) || '链接解析失败，无法识别为图片或视频', true);
      }).finally(function () {
        urlParsing = false;
        els.urlGo.disabled = false;
        els.urlGo.textContent = '解析';
      });
    }

    var IMG_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?.*)?(#.*)?$/i;
    var VIDEO_EXT = /\.(mp4|webm|ogg|mov|m4v)(\?.*)?(#.*)?$/i;

    function resolveMediaType(url) {
      if (IMG_EXT.test(url)) return probeImage(url);
      if (VIDEO_EXT.test(url)) return probeVideo(url).catch(function () { return probeImage(url); });

      // 扩展名无法判定：先尝试 HEAD/GET 读取 Content-Type
      return fetch(url, { method: 'GET', mode: 'cors' }).then(function (resp) {
        if (!resp.ok) throw new Error('链接返回异常状态码 ' + resp.status);
        var ct = (resp.headers.get('content-type') || '').toLowerCase();
        if (ct.indexOf('image/') === 0) return probeImage(url);
        if (ct.indexOf('video/') === 0) return probeVideo(url);
        throw new Error('该链接不是图片或视频资源（Content-Type: ' + (ct || '未知') + '）');
      }).catch(function (fetchErr) {
        // 跨域被拦截等情况下 fetch 本身会失败，退化为用媒体标签
        // 直接尝试加载探测——加载成功即视为可用资源，加载失败则
        // 明确报错，不能因为 fetch 失败就默认当作解析成功
        return probeImage(url).catch(function () {
          return probeVideo(url).catch(function () {
            throw new Error('无法解析此链接：' + (fetchErr && fetchErr.message ? fetchErr.message : '网络请求被拒绝或资源不可访问'));
          });
        });
      });
    }

    function probeImage(url) {
      return new Promise(function (resolve, reject) {
        var img = new Image();
        var done = false;
        var timer = setTimeout(function () {
          if (done) return;
          done = true;
          reject(new Error('图片加载超时，请检查链接是否有效'));
        }, 9000);
        img.onload = function () {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve('image');
        };
        img.onerror = function () {
          if (done) return;
          done = true;
          clearTimeout(timer);
          reject(new Error('无法解析为图片，链接可能已失效或不是图片资源'));
        };
        img.referrerPolicy = 'no-referrer';
        img.src = url;
      });
    }

    function probeVideo(url) {
      return new Promise(function (resolve, reject) {
        var video = document.createElement('video');
        video.muted = true;
        video.preload = 'metadata';
        var done = false;
        var timer = setTimeout(function () {
          if (done) return;
          done = true;
          reject(new Error('视频加载超时，请检查链接是否有效'));
        }, 9000);
        video.onloadedmetadata = function () {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve('video');
        };
        video.onerror = function () {
          if (done) return;
          done = true;
          clearTimeout(timer);
          reject(new Error('无法解析为视频，链接可能已失效或不是视频资源'));
        };
        video.src = url;
      });
    }

    /* ---- 实时预览：还原聊天室气泡叠在背景之上的实际观感 ---- */
    function renderPreview() {
      var d = state.draft;
      els.previewImg.hidden = true;
      els.previewVideo.hidden = true;
      els.previewVideo.pause && els.previewVideo.pause();
      els.previewEmpty.style.display = 'none';

      if (d.type === 'image' && d.src) {
        els.previewImg.src = d.src;
        els.previewImg.hidden = false;
        els.previewImg.classList.toggle('is-contain', d.fit === 'contain');
      } else if (d.type === 'video' && d.src) {
        if (els.previewVideo.getAttribute('src') !== d.src) els.previewVideo.setAttribute('src', d.src);
        els.previewVideo.hidden = false;
        els.previewVideo.classList.toggle('is-contain', d.fit === 'contain');
        var p = els.previewVideo.play();
        if (p && p.catch) p.catch(function () {});
      } else {
        els.previewEmpty.style.display = 'flex';
      }

      var dim = (d.dim != null ? d.dim : 30) / 100;
      els.previewScrim.style.background = 'rgba(10,10,12,' + dim.toFixed(2) + ')';

      els.previewLabel.textContent = '当前：' + describeConfig(d, state.scope, session);
    }

    function describeConfig(cfg, scope, session) {
      var scopeLabel = scope === 'char' ? ('「' + (session.name || '此角色') + '」专属') : '全局';
      if (!cfg || cfg.type === 'none' || !cfg.src) return scopeLabel + ' · 默认';
      var kindLabel = cfg.type === 'video' ? '视频背景' : '图片背景';
      return scopeLabel + ' · ' + kindLabel;
    }

    /* ---- 恢复默认：清空当前作用域的草稿（未点保存前不落库） ---- */
    els.resetBtn.addEventListener('click', function () {
      state.draft = { type: 'none', src: null, fit: 'cover', dim: 30 };
      els.urlInput.value = '';
      showUrlMsg('', false);
      applyDraftToControls();
      renderPreview();
    });

    /* ---- 保存：写入对应作用域的 key，成功后：
       1) 展示回执浮层
       2) 广播通知（BroadcastChannel + localStorage ping），
          让已经打开的聊天室页面无需刷新即可实时同步背景 ---- */
    els.saveBtn.addEventListener('click', function () {
      els.saveBtn.disabled = true;
      var payload = cloneConfig(state.draft);
      var key = keyForScope(state.scope);
      dbSet(key, payload).then(function (ok) {
        els.saveBtn.disabled = false;
        if (!ok) {
          showToast('保存失败，请重试');
          return;
        }
        showToast('已保存');
        broadcastChange(key);
      }).catch(function () {
        els.saveBtn.disabled = false;
        showToast('保存失败，请重试');
      });
    });

    function showToast(text) {
      els.toastText.textContent = text;
      els.toast.classList.add('is-open');
      els.toast.setAttribute('aria-hidden', 'false');
      clearTimeout(showToast._t);
      showToast._t = setTimeout(function () {
        els.toast.classList.remove('is-open');
        els.toast.setAttribute('aria-hidden', 'true');
      }, 1800);
    }

    /* ---- 广播：同标签页内 chatroom.js 若后续通过 pageshow / focus
       重新读取即可拿到最新值；跨标签页则用 BroadcastChannel 与
       localStorage 事件双通道，覆盖不支持 BroadcastChannel 的环境 ---- */
    function broadcastChange(key) {
      try {
        if ('BroadcastChannel' in window) {
          var bc = new BroadcastChannel(BG_CHANNEL);
          bc.postMessage({ key: key, ts: Date.now() });
          bc.close();
        }
      } catch (e) {}
      try {
        localStorage.setItem(BG_PING_KEY, JSON.stringify({ key: key, ts: Date.now() }));
      } catch (e) {}
    }

    /* ---- 初始加载：默认从「全局」范围开始 ---- */
    setScope('global');
  }

  /* ==========================================================================
     感知设置 · 双轨感应仪（user / char 分轨独立）
     - 地区感知：user 与 char 各自独立成轨，每一轨都可单独选择「真实」
       或「虚拟」，谁真实谁虚拟完全由用户自行决定，不互斥、不联动：
         真实：填写一个现实中真实存在的地名；
         虚拟：填写一个现实中并不存在的虚构地名。
       两轨的地名各自独立保存，同时存在、同时提交给 AI。
     - 时间感知：不再有「真实/虚拟」开关——每一轨的时间就是该轨当前
       地名所在地的实时时间，随「地区感知」变化而重新计算。地名若是
       真实存在的地方，用真实时区实时跳动；若查不到时区（多半是虚构
       地名），如实标注「无法获取」，绝不编造一个看似真实的时间。
     - 天气感知：user 与 char 各自基于自己当前的地区感知地名，独立
       请求一份真实天气（Nominatim 地理编码 + Open-Meteo 天气源）。
       地名查不到就如实报错，不编造数据；虚构地名本就没有真实天气
       可查，同样如实提示。
     全部数据按角色分别落库（与 bgSetting 同一套 char-<id> / name-<n>
     scoping 方式），不同聊天室之间互不干扰；刷新页面 / 重开聊天室都
     会保留上次的选择与已填写的内容。
  ========================================================================== */
  var PERC_CHANNEL = 'luna_perception_channel';
  var PERC_PING_KEY = 'luna_perception_ping';
  var WMO_MAP = {
    0: '晴朗', 1: '大致晴朗', 2: '局部多云', 3: '阴天',
    45: '有雾', 48: '雾凇',
    51: '毛毛雨', 53: '毛毛雨', 55: '密集毛毛雨',
    61: '小雨', 63: '中雨', 65: '大雨',
    71: '小雪', 73: '中雪', 75: '大雪', 77: '米雪',
    80: '阵雨', 81: '阵雨', 82: '强阵雨',
    85: '阵雪', 86: '强阵雪',
    95: '雷暴', 96: '雷暴伴冰雹', 99: '强雷暴伴冰雹'
  };
  var REGION_PRESETS = {
    real: ['上海', '北京', '东京', '纽约', '伦敦'],
    virtual: ['魔法学院', '永夜之城', '云端之上', '蒸汽都市', '彼岸镇']
  };

  /* ---- 地理编码与天气：统一使用 Open-Meteo（免费、无需注册、无需
     密钥、支持中文地名、全球覆盖），地区/时间/天气三张感应卡开箱即用，
     不需要用户做任何额外配置 ---- */
  var GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
  var FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

  function initPerception(session) {
    var p = {
      trackTabs: document.getElementById('cstRegionTrackTabs'),
      userBadge: document.getElementById('cstRegionUserBadge'),
      charBadge: document.getElementById('cstRegionCharBadge'),

      regionToggle: document.getElementById('cstRegionToggle'),
      regionInput: document.getElementById('cstRegionInput'),
      regionGo: document.getElementById('cstRegionGo'),
      regionPresetRow: document.getElementById('cstRegionPresetRow'),
      regionMeta: document.getElementById('cstRegionMeta'),
      regionMetaText: document.getElementById('cstRegionMetaText'),

      timeUserValue: document.getElementById('cstTimeUserValue'),
      timeUserDate: document.getElementById('cstTimeUserDate'),
      timeUserMeta: document.getElementById('cstTimeUserMeta'),
      timeUserMetaText: document.getElementById('cstTimeUserMetaText'),
      timeCharValue: document.getElementById('cstTimeCharValue'),
      timeCharDate: document.getElementById('cstTimeCharDate'),
      timeCharMeta: document.getElementById('cstTimeCharMeta'),
      timeCharMetaText: document.getElementById('cstTimeCharMetaText'),

      weatherUserValue: document.getElementById('cstWeatherUserValue'),
      weatherUserDesc: document.getElementById('cstWeatherUserDesc'),
      weatherUserMeta: document.getElementById('cstWeatherUserMeta'),
      weatherUserMetaText: document.getElementById('cstWeatherUserMetaText'),
      weatherUserFetchBtn: document.getElementById('cstWeatherUserFetchBtn'),
      weatherUserFetchBtnText: document.getElementById('cstWeatherUserFetchBtnText'),
      weatherCharValue: document.getElementById('cstWeatherCharValue'),
      weatherCharDesc: document.getElementById('cstWeatherCharDesc'),
      weatherCharMeta: document.getElementById('cstWeatherCharMeta'),
      weatherCharMetaText: document.getElementById('cstWeatherCharMetaText'),
      weatherCharFetchBtn: document.getElementById('cstWeatherCharFetchBtn'),
      weatherCharFetchBtnText: document.getElementById('cstWeatherCharFetchBtnText')
    };
    if (!p.trackTabs) return;

    /* ---- 按角色分轨落库：与 bgSetting:char-<id> / name-<n> 同一套
       scoping 方式，不同聊天室的 user/char 感知数据互不覆盖 ---- */
    var PERC_KEY = 'perception:' + (session && session.charId != null ? ('char-' + session.charId) : ('name-' + (session && session.name)));

    /* ---- 双轨状态：user 与 char 各自独立的 { mode, name, lat, lon, tz } ---- */
    var state = {
      activeTrack: 'user',
      user: { mode: 'real', name: null, lat: null, lon: null, tz: null },
      char: { mode: 'real', name: null, lat: null, lon: null, tz: null }
    };
    var timeTimer = null;

    function trackData(track) { return state[track]; }
    function trackLabel(track) { return track === 'char' ? '角色' : '用户'; }

    function persist() {
      dbSet(PERC_KEY, { user: cloneTrack(state.user), char: cloneTrack(state.char) });
      broadcastPerception(PERC_KEY);
    }
    function cloneTrack(t) { return { mode: t.mode, name: t.name, lat: t.lat, lon: t.lon, tz: t.tz }; }

    /* ------------------------------------------------------------
       地区感知：切换 user/char 轨道 与 真实/虚拟 模式时，均只是
       换一个「当前正在编辑哪一份独立数据」的视图，两轨数据互不覆盖。
    ------------------------------------------------------------ */
    function renderTrackTabs() {
      p.trackTabs.querySelectorAll('.cst-perc-track-tab').forEach(function (btn) {
        var track = btn.getAttribute('data-track');
        btn.classList.toggle('is-active', track === state.activeTrack);
      });
      p.userBadge.textContent = state.user.mode === 'virtual' ? '虚拟' : '真实';
      p.userBadge.classList.toggle('is-virtual', state.user.mode === 'virtual');
      p.charBadge.textContent = state.char.mode === 'virtual' ? '虚拟' : '真实';
      p.charBadge.classList.toggle('is-virtual', state.char.mode === 'virtual');
    }

    function setRegionMeta(text, kind) {
      p.regionMetaText.textContent = text;
      p.regionMeta.classList.remove('is-ok', 'is-error');
      if (kind) p.regionMeta.classList.add(kind);
    }

    function setRegionPreset(name) {
      p.regionPresetRow.querySelectorAll('.cst-perc-preset-chip').forEach(function (c) {
        c.classList.toggle('is-active', c.getAttribute('data-preset') === name);
      });
    }

    function renderPresetRow() {
      var mode = trackData(state.activeTrack).mode;
      var list = REGION_PRESETS[mode] || REGION_PRESETS.real;
      p.regionPresetRow.innerHTML = '';
      list.forEach(function (name) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'cst-perc-preset-chip';
        chip.setAttribute('data-preset', name);
        chip.textContent = name;
        p.regionPresetRow.appendChild(chip);
      });
    }

    function renderRegionView() {
      var t = trackData(state.activeTrack);
      p.regionToggle.querySelectorAll('.cst-perc-toggle-btn').forEach(function (b) {
        b.classList.toggle('is-active', b.getAttribute('data-mode') === t.mode);
      });
      p.regionInput.placeholder = t.mode === 'virtual'
        ? '填写一个不存在的虚构地区，如「魔法学院」'
        : '填写一个真实存在的地区，如「上海」「东京」';
      p.regionInput.value = t.name || '';
      renderPresetRow();
      if (t.name) {
        setRegionPreset(t.name);
        setRegionMeta((trackLabel(state.activeTrack)) + ' · 当前' + (t.mode === 'virtual' ? '虚拟' : '真实') + '地区：' + t.name, 'is-ok');
      } else {
        setRegionMeta((trackLabel(state.activeTrack)) + ' · 当前地区：未指定', null);
      }
    }

    function switchTrack(track) {
      state.activeTrack = track;
      renderTrackTabs();
      renderRegionView();
    }
    if (p.trackTabs) {
      p.trackTabs.addEventListener('click', function (evt) {
        var btn = evt.target.closest('.cst-perc-track-tab');
        if (!btn) return;
        switchTrack(btn.getAttribute('data-track'));
      });
    }

    function applyRegionMode(mode) {
      trackData(state.activeTrack).mode = mode;
      renderTrackTabs();
      renderRegionView();
      persist();
    }
    if (p.regionToggle) {
      p.regionToggle.addEventListener('click', function (evt) {
        var btn = evt.target.closest('.cst-perc-toggle-btn');
        if (!btn) return;
        applyRegionMode(btn.getAttribute('data-mode'));
      });
    }

    function applyRegionName(name) {
      name = (name || '').trim();
      if (!name) return;
      var t = trackData(state.activeTrack);
      t.name = name;
      t.lat = null; t.lon = null; t.tz = null; /* 地名变更，之前解析出的坐标/时区失效，重新查询 */
      renderRegionView();
      persist();
      resolveTrackTimeAndZone(state.activeTrack);
    }
    if (p.regionPresetRow) {
      p.regionPresetRow.addEventListener('click', function (evt) {
        var chip = evt.target.closest('.cst-perc-preset-chip');
        if (!chip) return;
        var name = chip.getAttribute('data-preset');
        p.regionInput.value = name;
        applyRegionName(name);
      });
    }
    if (p.regionGo) {
      p.regionGo.addEventListener('click', function () { applyRegionName(p.regionInput.value); });
    }
    if (p.regionInput) {
      p.regionInput.addEventListener('keydown', function (evt) {
        if (evt.key === 'Enter') applyRegionName(p.regionInput.value);
      });
    }

    /* ---- 正向地理编码：地名 → 经纬度 + 时区，查不到就如实报错，并把
       失败原因原样带出去（不用一句笼统的"查询失败"盖住真实原因，方便
       排查）。同一个地名的坐标只查一次、结果与「时间」「天气」共享。
       使用 Open-Meteo Geocoding API：免费、无需注册、无需密钥，支持
       中文地名搜索，返回结果里自带 IANA 时区名，通常无需再单独请求
       时区接口。 ---- */
    function forwardGeocode(name) {
      var url = GEOCODE_URL + '?name=' + encodeURIComponent(name) + '&count=1&language=zh';
      return fetch(url).then(function (resp) {
        if (!resp.ok) { var e = new Error('地理编码接口返回 ' + resp.status); e.code = 'geocode_http_' + resp.status; throw e; }
        return resp.json();
      }).then(function (data) {
        var list = data && data.results;
        if (!list || !list.length) { var e2 = new Error('地名未找到'); e2.code = 'geocode_empty'; throw e2; }
        var g = list[0];
        if (typeof g.latitude !== 'number' || typeof g.longitude !== 'number') {
          var e4 = new Error('接口未返回有效坐标'); e4.code = 'geocode_empty'; throw e4;
        }
        return { lat: g.latitude, lon: g.longitude, label: g.name, timezone: g.timezone || null };
      }).catch(function (err) {
        if (err && err.code) throw err;
        var e3 = new Error('地理编码请求失败（可能是网络问题）：' + (err && err.message ? err.message : err));
        e3.code = 'geocode_network';
        throw e3;
      });
    }

    /* ---- 由经纬度取当前时区：仅当地理编码结果没带 timezone 字段时才
       兜底调用，同样是 Open-Meteo、同样免密钥，失败原因照样原样带出去 ---- */
    function fetchTzTime(lat, lon) {
      var url = FORECAST_URL + '?latitude=' + lat + '&longitude=' + lon + '&current=temperature_2m&timezone=auto';
      return fetch(url).then(function (resp) {
        if (!resp.ok) { var e = new Error('时区接口返回 ' + resp.status); e.code = 'tz_http_' + resp.status; throw e; }
        return resp.json();
      }).then(function (data) {
        if (!data || !data.timezone) { var e2 = new Error('接口未返回时区'); e2.code = 'tz_empty'; throw e2; }
        return data.timezone;
      }).catch(function (err) {
        if (err && err.code) throw err;
        var e3 = new Error('时区请求失败（可能是网络问题）：' + (err && err.message ? err.message : err));
        e3.code = 'tz_network';
        throw e3;
      });
    }

    /* ---- 坐标解析缓存：同一个地名在同一次会话内已解析过的经纬度 /
       时区，时间感知和天气感知共用，避免对同一地名重复调用接口 ---- */
    var geocodeCache = {};
    function geocodeCached(name) {
      if (geocodeCache[name]) return geocodeCache[name];
      var promise = forwardGeocode(name).catch(function (err) {
        delete geocodeCache[name]; /* 失败不缓存，允许下次重试 */
        throw err;
      });
      geocodeCache[name] = promise;
      return promise;
    }

    /* ---- 时间显示：给定轨道，按其当前 tz 实时渲染当地时刻；
       没有可用 tz（虚构地名 / 尚未解析 / 查询失败）时如实显示原因 ---- */
    function renderTrackClock(track, errorText) {
      var t = trackData(track);
      var valueEl = track === 'char' ? p.timeCharValue : p.timeUserValue;
      var dateEl = track === 'char' ? p.timeCharDate : p.timeUserDate;
      var metaEl = track === 'char' ? p.timeCharMeta : p.timeUserMeta;
      var metaTextEl = track === 'char' ? p.timeCharMetaText : p.timeUserMetaText;

      if (!t.name) {
        valueEl.textContent = '—';
        dateEl.textContent = '未指定地区';
        metaEl.classList.remove('is-ok', 'is-error');
        metaTextEl.textContent = '请先在地区感知中填写' + trackLabel(track) + '所在地区';
        return;
      }
      if (!t.tz) {
        valueEl.textContent = '—';
        dateEl.textContent = t.name;
        metaEl.classList.remove('is-ok');
        metaEl.classList.add('is-error');
        metaTextEl.textContent = errorText || ('「' + t.name + '」时区尚未获取');
        return;
      }
      try {
        var now = new Date();
        var fmt = new Intl.DateTimeFormat('zh-CN', { timeZone: t.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, month: 'long', day: 'numeric', weekday: 'short' });
        var parts = fmt.formatToParts(now);
        var get = function (type) { var f = parts.find(function (x) { return x.type === type; }); return f ? f.value : ''; };
        valueEl.textContent = get('hour') + ':' + get('minute') + ':' + get('second');
        dateEl.textContent = get('month') + get('day') + '日 · ' + get('weekday');
        metaEl.classList.remove('is-error');
        metaEl.classList.add('is-ok');
        metaTextEl.textContent = t.name + ' · ' + t.tz;
      } catch (e) {
        valueEl.textContent = '—';
        metaEl.classList.remove('is-ok');
        metaEl.classList.add('is-error');
        metaTextEl.textContent = '「' + t.name + '」时区数据异常：' + e.message;
      }
    }

    function startClockLoop() {
      clearInterval(timeTimer);
      timeTimer = setInterval(function () {
        renderTrackClock('user');
        renderTrackClock('char');
      }, 1000);
    }

    /* ---- 由地区名解析出坐标 + 时区（真实地名成功；虚构地名/查询失败
       会把具体原因显示在时间卡的提示文字里，不用一句模糊的"无法获取"
       盖过真实原因） ---- */
    function resolveTrackTimeAndZone(track) {
      var t = trackData(track);
      if (!t.name) { renderTrackClock(track); return Promise.resolve(); }
      var name = t.name;
      return geocodeCached(name).then(function (geo) {
        if (t.name !== name) return; /* 解析期间地名已被改成别的，结果作废 */
        t.lat = geo.lat; t.lon = geo.lon;
        if (geo.timezone) {
          /* 地理编码结果已自带时区，无需再单独请求 */
          t.tz = geo.timezone;
          persist();
          renderTrackClock(track);
          return;
        }
        return fetchTzTime(geo.lat, geo.lon).then(function (tz) {
          if (t.name !== name) return;
          t.tz = tz;
          persist();
          renderTrackClock(track);
        });
      }).catch(function (err) {
        if (t.name !== name) return;
        t.tz = null;
        persist();
        var reason = (err && err.code === 'geocode_empty')
          ? '「' + name + '」未查到这个地名' + (t.mode === 'virtual' ? '（虚构地区，属正常现象）' : '，请确认拼写或是否真实存在')
          : '「' + name + '」查询失败：' + (err && err.message ? err.message : '未知错误');
        renderTrackClock(track, reason);
      });
    }

    /* ------------------------------------------------------------
       天气感知：user 与 char 各自基于自己当前地区感知的地名，独立
       请求一份真实天气；地名查不到就如实报错，不编造数据。
    ------------------------------------------------------------ */
    function weatherEls(track) {
      return track === 'char'
        ? { value: p.weatherCharValue, desc: p.weatherCharDesc, meta: p.weatherCharMeta, metaText: p.weatherCharMetaText, btn: p.weatherCharFetchBtn, btnText: p.weatherCharFetchBtnText }
        : { value: p.weatherUserValue, desc: p.weatherUserDesc, meta: p.weatherUserMeta, metaText: p.weatherUserMetaText, btn: p.weatherUserFetchBtn, btnText: p.weatherUserFetchBtnText };
    }
    function setWeatherMeta(track, text, kind) {
      var els = weatherEls(track);
      els.metaText.textContent = text;
      els.meta.classList.remove('is-ok', 'is-error');
      if (kind) els.meta.classList.add(kind);
    }

    /* ---- 取实况天气（Open-Meteo /v1/forecast，current 参数返回实况），
       免费、无需密钥，失败原因原样带出去 ---- */
    function fetchOpenMeteoWeather(lat, lon) {
      var url = FORECAST_URL + '?latitude=' + lat + '&longitude=' + lon + '&current=temperature_2m,weather_code,relative_humidity_2m&timezone=auto';
      return fetch(url).then(function (resp) {
        if (!resp.ok) { var e = new Error('天气接口返回 ' + resp.status); throw e; }
        return resp.json();
      }).then(function (data) {
        var cur = data && data.current;
        if (!cur) { var e2 = new Error('接口未返回天气数据'); throw e2; }
        return cur;
      });
    }

    function fetchWeather(track) {
      var t = trackData(track);
      var els = weatherEls(track);
      var regionName = t.name;
      if (!regionName) {
        setWeatherMeta(track, '请先在「地区感知 · ' + trackLabel(track) + '」中填写地区', 'is-error');
        return;
      }
      els.btn.disabled = true;
      els.btnText.textContent = '获取中…';
      setWeatherMeta(track, '正在定位「' + regionName + '」…', null);

      geocodeCached(regionName).then(function (geo) {
        t.lat = geo.lat; t.lon = geo.lon;
        setWeatherMeta(track, '正在向真实气象源请求「' + regionName + '」的天气…', null);
        return fetchOpenMeteoWeather(geo.lat, geo.lon).then(function (cur) {
          var temp = Math.round(cur.temperature_2m);
          var desc = WMO_MAP[cur.weather_code] || '气象数据';
          var humidity = cur.relative_humidity_2m != null ? cur.relative_humidity_2m : null;
          els.value.textContent = temp + '°C';
          els.desc.textContent = desc + (humidity != null ? (' · 湿度 ' + Math.round(humidity) + '%') : '');
          setWeatherMeta(track, '「' + regionName + '」· 数据来自真实气象源，刚刚更新', 'is-ok');
          dbSet(PERC_KEY + ':weather:' + track, { regionName: regionName, temp: temp, desc: desc, humidity: humidity, ts: Date.now(), lat: geo.lat, lon: geo.lon });
          persist();
          broadcastPerception(PERC_KEY);
        });
      }).catch(function (err) {
        var reason = (err && err.code === 'geocode_empty')
          ? ('未查到「' + regionName + '」这个地名，' + (t.mode === 'virtual' ? '虚构地区没有真实天气可查' : '请确认拼写或是否真实存在'))
          : ('「' + regionName + '」查询失败：' + (err && err.message ? err.message : '未知错误'));
        setWeatherMeta(track, reason, 'is-error');
      }).finally(function () {
        els.btn.disabled = false;
        els.btnText.textContent = '重新获取';
      });
    }
    if (p.weatherUserFetchBtn) p.weatherUserFetchBtn.addEventListener('click', function () { fetchWeather('user'); });
    if (p.weatherCharFetchBtn) p.weatherCharFetchBtn.addEventListener('click', function () { fetchWeather('char'); });

    /* ---- 广播：与背景设置同一套双通道机制，跨标签页同步感知数据 ---- */
    function broadcastPerception(key) {
      try {
        if ('BroadcastChannel' in window) {
          var bc = new BroadcastChannel(PERC_CHANNEL);
          bc.postMessage({ key: key, ts: Date.now() });
          bc.close();
        }
      } catch (e) {}
      try { localStorage.setItem(PERC_PING_KEY, JSON.stringify({ key: key, ts: Date.now() })); } catch (e) {}
    }

    /* ---- 恢复已保存的双轨地区状态，并据此各自解析时区 + 回显已存天气；
       地理编码 / 天气均为免密钥的 Open-Meteo，无需任何前置配置检查 ---- */
    (function () {
      dbGet(PERC_KEY).then(function (saved) {
        if (saved) {
          if (saved.user) { state.user.mode = saved.user.mode === 'virtual' ? 'virtual' : 'real'; state.user.name = saved.user.name || null; state.user.lat = saved.user.lat || null; state.user.lon = saved.user.lon || null; state.user.tz = saved.user.tz || null; }
          if (saved.char) { state.char.mode = saved.char.mode === 'virtual' ? 'virtual' : 'real'; state.char.name = saved.char.name || null; state.char.lat = saved.char.lat || null; state.char.lon = saved.char.lon || null; state.char.tz = saved.char.tz || null; }
        }
        renderTrackTabs();
        renderRegionView();
        renderTrackClock('user');
        renderTrackClock('char');
        startClockLoop();
        /* 若已有保存的坐标/时区直接复用；否则如果填了地名但没有 tz，尝试补一次解析 */
        if (state.user.name && !state.user.tz) resolveTrackTimeAndZone('user');
        if (state.char.name && !state.char.tz) resolveTrackTimeAndZone('char');

        dbGet(PERC_KEY + ':weather:user').then(function (w) { applySavedWeather('user', w); });
        dbGet(PERC_KEY + ':weather:char').then(function (w) { applySavedWeather('char', w); });
      });
    })();

    function applySavedWeather(track, saved) {
      if (!saved || saved.temp == null) return;
      var els = weatherEls(track);
      els.value.textContent = saved.temp + '°C';
      els.desc.textContent = (saved.desc || '气象数据') + (saved.humidity != null ? (' · 湿度 ' + Math.round(saved.humidity) + '%') : '');
      var ageMin = saved.ts ? Math.round((Date.now() - saved.ts) / 60000) : null;
      var label = saved.regionName ? ('「' + saved.regionName + '」· ') : '';
      setWeatherMeta(track, ageMin != null ? (label + '上次获取于 ' + ageMin + ' 分钟前') : (label + '已保存的真实天气'), 'is-ok');
      els.btnText.textContent = '重新获取';
    }
  }

  /* ==========================================================================
     世界书感知 · 本聊天室生效条目
     - 条目内容本身（标题/关键词/详情/常驻规则等）统一在「世界书」页
       （worldbook.js / LunaWorldBookDB / entries）维护，本页绝不重复
       定义，也不在这里编辑条目正文——只读取列表供勾选。
     - 「生效」= 这个聊天室要不要用某条条目，与「世界书」页里条目
       自己的「启用/禁用」开关是两层独立判定：条目自己被禁用后，
       即使这里勾选了也不会真正注入（与 worldbook.js 里 enabled 语义
       保持一致），列表里会对已禁用的条目如实标注，不隐藏、不假装
       它仍然有效。
     - 作用域与背景设置同一套逻辑：
         全局启用集 —— worldbookLink:global
         仅此角色   —— worldbookLink:char-<id> / name-<n>
       两套启用集各自是一份「已勾选条目 id」的数组，互不覆盖；
       角色轨若没有单独保存过，聊天室侧读取时会回退到全局启用集
       （与背景设置「未单独设置的聊天室使用全局」语义一致）。
     - 勾选即落库、无需等待页面底部的「保存」——因为这里本质是一份
       清单式的开关组，与感知设置里天气/地区的即时持久化是同一种
       交互预期，而不是像背景一样需要先预览再决定。
  ========================================================================== */
  var WB_CHANNEL = 'luna_worldbook_link_channel';
  var WB_PING_KEY = 'luna_worldbook_link_ping';

  function initWorldbookLink(session) {
    var w = {
      scopeGlobal: document.getElementById('cstWbScopeGlobal'),
      scopeChar: document.getElementById('cstWbScopeChar'),
      scopeHint: document.getElementById('cstWbScopeHint'),

      statTotal: document.getElementById('cstWbStatTotal'),
      statConst: document.getElementById('cstWbStatConst'),
      statActive: document.getElementById('cstWbStatActive'),
      statActiveLabel: document.getElementById('cstWbStatActiveLabel'),

      searchInput: document.getElementById('cstWbSearchInput'),
      filterRow: document.getElementById('cstWbFilterRow'),

      selectAllBtn: document.getElementById('cstWbSelectAllBtn'),
      clearBtn: document.getElementById('cstWbClearBtn'),

      list: document.getElementById('cstWbList'),
      empty: document.getElementById('cstWbEmpty')
    };
    if (!w.list) return;

    var globalKey = 'worldbookLink:global';
    var charKey = 'worldbookLink:' + (session && session.charId != null ? ('char-' + session.charId) : ('name-' + (session && session.name)));

    var allEntries = [];
    var state = {
      scope: 'global',
      filterCat: 'all',
      searchQ: '',
      selectedGlobal: [],   // 全局启用集：条目 id 数组
      selectedChar: null    // 仅此角色启用集：null = 未单独设置，跟随全局；否则为独立数组
    };

    /* ---- 世界书条目：只读，直接复用 worldbook.js 同一个 IndexedDB
       （LunaWorldBookDB / entries），不新造数据源 ---- */
    var _wbReadDb = null;
    function openWbReadDB() {
      return new Promise(function (resolve, reject) {
        if (_wbReadDb) { resolve(_wbReadDb); return; }
        var req = indexedDB.open('LunaWorldBookDB', 2);
        req.onupgradeneeded = function (e) {
          if (!e.target.result.objectStoreNames.contains('entries')) {
            e.target.result.createObjectStore('entries', { keyPath: 'id', autoIncrement: true });
          }
        };
        req.onsuccess = function (e) { _wbReadDb = e.target.result; resolve(_wbReadDb); };
        req.onerror = function () { reject(new Error('worldbook db error')); };
      });
    }
    function getAllWbEntries() {
      return openWbReadDB().catch(function () { return null; }).then(function (db) {
        if (!db || !db.objectStoreNames.contains('entries')) return [];
        return new Promise(function (resolve) {
          var req = db.transaction('entries').objectStore('entries').getAll();
          req.onsuccess = function () { resolve(req.result || []); };
          req.onerror = function () { resolve([]); };
        });
      });
    }

    /* ---- 当前生效的选中集：char 轨若未单独设置则回退到 global ---- */
    function activeSelection() {
      if (state.scope === 'char') {
        return state.selectedChar != null ? state.selectedChar : state.selectedGlobal;
      }
      return state.selectedGlobal;
    }
    function isFollowingGlobal() {
      return state.scope === 'char' && state.selectedChar == null;
    }

    function setScope(scope) {
      state.scope = scope;
      w.scopeGlobal.classList.toggle('is-active', scope === 'global');
      w.scopeChar.classList.toggle('is-active', scope === 'char');
      w.scopeHint.textContent = scope === 'global'
        ? '应用于所有未单独设置的聊天室'
        : (state.selectedChar != null
            ? ('仅应用于「' + (session.name || '这位好友') + '」的聊天室，优先于全局启用集')
            : ('「' + (session.name || '这位好友') + '」尚未单独设置，当前跟随全局启用集——勾选任意一项即视为为此角色单独建立一套')
          );
      w.statActiveLabel.textContent = scope === 'char' ? '本聊天室生效' : '全局生效';
      renderList();
    }
    if (w.scopeGlobal) w.scopeGlobal.addEventListener('click', function () { setScope('global'); });
    if (w.scopeChar) w.scopeChar.addEventListener('click', function () { setScope('char'); });

    /* ---- 落库 + 广播：与背景设置同一套双通道，跨标签页实时同步 ---- */
    function persistGlobal() {
      dbSet(globalKey, { ids: state.selectedGlobal.slice() });
      broadcastWbChange(globalKey);
    }
    function persistChar() {
      if (state.selectedChar == null) {
        dbSet(charKey, null);
      } else {
        dbSet(charKey, { ids: state.selectedChar.slice() });
      }
      broadcastWbChange(charKey);
    }
    function broadcastWbChange(key) {
      try {
        if ('BroadcastChannel' in window) {
          var bc = new BroadcastChannel(WB_CHANNEL);
          bc.postMessage({ key: key, ts: Date.now() });
          bc.close();
        }
      } catch (e) {}
      try { localStorage.setItem(WB_PING_KEY, JSON.stringify({ key: key, ts: Date.now() })); } catch (e) {}
    }

    /* ---- 勾选/取消：char 轨首次勾选时，自动从「跟随全局」
       转为「独立启用集」，起点为当前全局选中集，而不是从空集开始，
       这样第一次点选不会意外清空所有已生效的条目 ---- */
    function toggleEntry(id) {
      if (state.scope === 'global') {
        var idx = state.selectedGlobal.indexOf(id);
        if (idx === -1) state.selectedGlobal.push(id); else state.selectedGlobal.splice(idx, 1);
        persistGlobal();
      } else {
        if (state.selectedChar == null) state.selectedChar = state.selectedGlobal.slice();
        var idx2 = state.selectedChar.indexOf(id);
        if (idx2 === -1) state.selectedChar.push(id); else state.selectedChar.splice(idx2, 1);
        persistChar();
      }
      renderList();
    }

    /* ---- 全选当前筛选 / 清空本轨 ---- */
    if (w.selectAllBtn) {
      w.selectAllBtn.addEventListener('click', function () {
        var visibleIds = filteredEntries().map(function (e) { return e.id; });
        if (state.scope === 'global') {
          var set = new Set(state.selectedGlobal);
          visibleIds.forEach(function (id) { set.add(id); });
          state.selectedGlobal = Array.from(set);
          persistGlobal();
        } else {
          var base = state.selectedChar != null ? state.selectedChar : state.selectedGlobal.slice();
          var set2 = new Set(base);
          visibleIds.forEach(function (id) { set2.add(id); });
          state.selectedChar = Array.from(set2);
          persistChar();
        }
        renderList();
        showWbToast('已全选当前筛选范围内的条目');
      });
    }
    if (w.clearBtn) {
      w.clearBtn.addEventListener('click', function () {
        if (state.scope === 'global') {
          state.selectedGlobal = [];
          persistGlobal();
        } else {
          state.selectedChar = [];
          persistChar();
        }
        renderList();
        showWbToast(state.scope === 'char' ? '已清空本角色专属启用集' : '已清空全局启用集');
      });
    }

    /* ---- 搜索 / 分类筛选 ---- */
    if (w.searchInput) {
      w.searchInput.addEventListener('input', function () {
        state.searchQ = w.searchInput.value.trim().toLowerCase();
        renderList();
      });
    }
    if (w.filterRow) {
      w.filterRow.addEventListener('click', function (evt) {
        var chip = evt.target.closest('.cst-wb-filter-chip');
        if (!chip) return;
        w.filterRow.querySelectorAll('.cst-wb-filter-chip').forEach(function (c) { c.classList.remove('is-active'); });
        chip.classList.add('is-active');
        state.filterCat = chip.getAttribute('data-cat');
        renderList();
      });
    }

    function filteredEntries() {
      var list = allEntries;
      if (state.filterCat !== 'all') list = list.filter(function (e) { return e.cat === state.filterCat; });
      if (state.searchQ) {
        var q = state.searchQ;
        list = list.filter(function (e) {
          return (e.title || '').toLowerCase().indexOf(q) !== -1 ||
                 (e.keywords || '').toLowerCase().indexOf(q) !== -1 ||
                 (e.keywordsSec || '').toLowerCase().indexOf(q) !== -1 ||
                 (e.sub || '').toLowerCase().indexOf(q) !== -1;
        });
      }
      // 常驻条目置顶，同组内按优先级降序 —— 与世界书页列表排序口径一致
      return list.slice().sort(function (a, b) {
        var ac = a.mode === 'constant' ? 0 : 1;
        var bc = b.mode === 'constant' ? 0 : 1;
        if (ac !== bc) return ac - bc;
        return (b.priority != null ? b.priority : 5) - (a.priority != null ? a.priority : 5);
      });
    }

    function posLabelWb(pos) {
      var map = { before: '对话前', after: '对话后', system: '系统层' };
      return map[pos] || pos || '对话前';
    }

    function escWbHtml(s) {
      return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function renderList() {
      var selection = activeSelection();
      var selectedSet = new Set(selection);
      var list = filteredEntries();

      w.statTotal.textContent = String(allEntries.length).padStart(2, '0');
      w.statConst.textContent = String(allEntries.filter(function (e) { return e.mode === 'constant'; }).length).padStart(2, '0');
      // 生效数只统计「本轨勾选 且 条目自身未被禁用」的条目，与实际注入口径一致
      var activeCount = allEntries.filter(function (e) { return selectedSet.has(e.id) && e.enabled !== false; }).length;
      w.statActive.textContent = String(activeCount).padStart(2, '0');

      if (allEntries.length === 0) {
        w.list.innerHTML = '';
        w.empty.hidden = false;
        return;
      }
      w.empty.hidden = true;

      if (list.length === 0) {
        w.list.innerHTML = '<div class="cst-wb-row-meta" style="padding:16px 4px;justify-content:center;">未找到匹配的条目</div>';
        return;
      }

      w.list.innerHTML = list.map(function (e) {
        var checked = selectedSet.has(e.id);
        var disabledEntry = e.enabled === false;
        var isConst = e.mode === 'constant';
        var kwFirst = (e.keywords || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean)[0] || '';
        var metaBits = [];
        if (isConst) {
          metaBits.push('优先级 P' + (e.priority != null ? e.priority : 5));
        } else {
          if (kwFirst) metaBits.push('关键词「' + escWbHtml(kwFirst) + '」');
          metaBits.push((e.probability != null ? e.probability : 100) + '% 概率');
        }
        metaBits.push(posLabelWb(e.pos));

        return '' +
          '<div class="cst-wb-row' + (checked ? ' is-checked' : '') + (disabledEntry ? ' is-disabled-entry' : '') + '" data-id="' + e.id + '">' +
            '<span class="cst-wb-row-check" aria-hidden="true">' +
              '<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12.5L9.5 17L19 6.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            '</span>' +
            '<div class="cst-wb-row-body">' +
              '<div class="cst-wb-row-top">' +
                '<span class="cst-wb-row-title">' + escWbHtml(e.title || '未命名') + '</span>' +
                '<span class="cst-wb-row-cat">' + escWbHtml(e.cat || '其他') + '</span>' +
                (isConst ? '<span class="cst-wb-row-const"><svg width="7" height="7" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.4"/></svg>常驻</span>' : '') +
                (disabledEntry ? '<span class="cst-wb-row-disabled-tag">条目已禁用</span>' : '') +
              '</div>' +
              '<div class="cst-wb-row-sub">' + escWbHtml(e.sub || '无描述') + '</div>' +
              '<div class="cst-wb-row-meta">' + metaBits.map(escWbHtml).join('<span class="cst-wb-row-meta-dot"> · </span>') + '</div>' +
            '</div>' +
          '</div>';
      }).join('');

      w.list.querySelectorAll('.cst-wb-row').forEach(function (row) {
        row.addEventListener('click', function () {
          toggleEntry(parseInt(row.getAttribute('data-id'), 10));
        });
      });
    }

    var _wbToastTimer = null;
    function showWbToast(text) {
      var toastEl = document.getElementById('cstToastText');
      var wrapEl = document.getElementById('cstToast');
      if (!toastEl || !wrapEl) return;
      toastEl.textContent = text;
      wrapEl.classList.add('is-open');
      wrapEl.setAttribute('aria-hidden', 'false');
      clearTimeout(_wbToastTimer);
      _wbToastTimer = setTimeout(function () {
        wrapEl.classList.remove('is-open');
        wrapEl.setAttribute('aria-hidden', 'true');
      }, 1800);
    }

    /* ---- 初始加载：读世界书全部条目 + 两套已保存的启用集 ---- */
    Promise.all([
      getAllWbEntries(),
      dbGet(globalKey),
      dbGet(charKey)
    ]).then(function (res) {
      allEntries = res[0] || [];
      state.selectedGlobal = (res[1] && Array.isArray(res[1].ids)) ? res[1].ids.slice() : [];
      state.selectedChar = (res[2] && Array.isArray(res[2].ids)) ? res[2].ids.slice() : null;
      setScope('global');
    });

    /* ---- 跨标签页同步：世界书页新增/删除条目，或其它标签页调整了
       启用集时，本页重新拉取一次，保持三端（世界书 / 聊天设置 / 
       聊天室）看到的数据始终一致 ---- */
    window.addEventListener('storage', function (e) {
      if (e.key === 'luna_char_db_update' || e.key === WB_PING_KEY) {
        getAllWbEntries().then(function (list) { allEntries = list; renderList(); });
      }
    });
    try {
      if ('BroadcastChannel' in window) {
        var bcListen = new BroadcastChannel(WB_CHANNEL);
        bcListen.onmessage = function () {
          Promise.all([dbGet(globalKey), dbGet(charKey)]).then(function (res2) {
            state.selectedGlobal = (res2[0] && Array.isArray(res2[0].ids)) ? res2[0].ids.slice() : [];
            state.selectedChar = (res2[1] && Array.isArray(res2[1].ids)) ? res2[1].ids.slice() : null;
            renderList();
          });
        };
      }
    } catch (e) {}
  }

  /* ==========================================================================
     语音设置 · 本聊天室专属音色
     - 音色预设本身（名称/Group ID/API Key/Voice ID/模型）统一在
       「设置 → 语音模型」页维护与保存（settings.js / LunaVoiceDB / presets），
       本页绝不重复保存新的预设，也不在这里编辑预设字段——只读取列表
       供单选绑定，且渲染时不展示 apiKey 等敏感字段。
     - 「绑定」= 这个聊天室发语音/朗读时用哪一枚已保存的预设，与
       「语音模型」页里当前全局激活的预设（luna_voice_active_id）是
       两层独立判定：本页绑定优先于全局激活预设生效。
     - 作用域与世界书感知同一套逻辑：
         全局绑定 —— voiceLink:global
         仅此角色 —— voiceLink:char-<id> / name-<n>
       两套绑定各自存放 { presetId } 或 null（未绑定/解绑）；
       角色轨若没有单独绑定过，聊天室侧读取时回退到全局绑定，
       全局也未绑定时則回退「系统默认」（即语音模型页当前激活预设）。
     - 单选即落库、无需等待页面底部的「保存」，与世界书感知的
       即时持久化交互预期一致。
  ========================================================================== */
  var VOICE_CHANNEL = 'luna_voice_link_channel';
  var VOICE_PING_KEY = 'luna_voice_link_ping';

  function initVoiceLink(session) {
    var v = {
      scopeGlobal: document.getElementById('cstVoiceScopeGlobal'),
      scopeChar: document.getElementById('cstVoiceScopeChar'),
      scopeHint: document.getElementById('cstVoiceScopeHint'),

      currentCard: document.getElementById('cstVoiceCurrentCard'),
      currentName: document.getElementById('cstVoiceCurrentName'),
      currentMeta: document.getElementById('cstVoiceCurrentMeta'),
      currentTag: document.getElementById('cstVoiceCurrentTag'),

      trigger: document.getElementById('cstVoiceTrigger'),
      triggerLabel: document.getElementById('cstVoiceTriggerLabel'),
      empty: document.getElementById('cstVoiceEmpty'),

      panelMask: document.getElementById('cstVoicePanelMask'),
      panel: document.getElementById('cstVoicePanel'),
      panelClose: document.getElementById('cstVoicePanelClose'),
      panelSearch: document.getElementById('cstVoicePanelSearch'),
      panelTabs: document.getElementById('cstVoicePanelTabs'),
      panelList: document.getElementById('cstVoicePanelList'),
      panelNoRes: document.getElementById('cstVoicePanelNoRes'),

      quickrow: document.getElementById('cstVoiceQuickrow'),
      unbindBtn: document.getElementById('cstVoiceUnbindBtn')
    };
    if (!v.trigger) return;

    var panelCat = 'all';
    var panelQuery = '';

    var globalKey = 'voiceLink:global';
    var charKey = 'voiceLink:' + (session && session.charId != null ? ('char-' + session.charId) : ('name-' + (session && session.name)));

    // catalog：{ system:[{voice_id,voice_name}], voice_cloning:[...], voice_generation:[...] }
    // 直接来自「语音模型」页拉取账号音色列表时写入的 luna_voice_catalog，
    // 三个分类分别对应 系统音色 / 克隆音色 / 捏音色（音色设计）
    var catalog = { system: [], voice_cloning: [], voice_generation: [] };
    var state = {
      scope: 'global',
      boundGlobal: null,  // 全局绑定：voice_id 字符串，null = 未绑定，跟随系统默认
      boundChar: undefined // 仅此角色绑定：undefined = 未单独设置，跟随全局；null = 明确解绑（不跟随）；否则为 voice_id
    };

    function readCatalog() {
      try {
        var raw = localStorage.getItem('luna_voice_catalog');
        if (!raw) return { system: [], voice_cloning: [], voice_generation: [] };
        var parsed = JSON.parse(raw);
        return {
          system: parsed.system || [],
          voice_cloning: parsed.voice_cloning || [],
          voice_generation: parsed.voice_generation || []
        };
      } catch (e) { return { system: [], voice_cloning: [], voice_generation: [] }; }
    }
    function catalogIsEmpty() {
      return catalog.system.length === 0 && catalog.voice_cloning.length === 0 && catalog.voice_generation.length === 0;
    }
    function findVoice(voiceId) {
      if (!voiceId) return null;
      var all = catalog.system.concat(catalog.voice_cloning, catalog.voice_generation);
      for (var i = 0; i < all.length; i++) { if (all[i].voice_id === voiceId) return all[i]; }
      return null;
    }

    /* ---- 当前生效的绑定：char 轨若未单独设置(undefined)则回退到 global，
       char 轨明确解绑(null)则视为「不跟随」，直接落到系统默认 ---- */
    function activeBoundId() {
      if (state.scope === 'char') {
        return state.boundChar !== undefined ? state.boundChar : state.boundGlobal;
      }
      return state.boundGlobal;
    }
    function isFollowingGlobal() {
      return state.scope === 'char' && state.boundChar === undefined;
    }

    function setScope(scope) {
      state.scope = scope;
      v.scopeGlobal.classList.toggle('is-active', scope === 'global');
      v.scopeChar.classList.toggle('is-active', scope === 'char');
      v.scopeHint.textContent = scope === 'global'
        ? '应用于所有未单独设置的聊天室'
        : (state.boundChar !== undefined
            ? ('仅应用于「' + (session.name || '这位好友') + '」的聊天室，优先于全局音色')
            : ('「' + (session.name || '这位好友') + '」尚未单独设置，当前跟随全局音色——选择任意一枚即为此角色单独绑定')
          );
      renderAll();
    }
    if (v.scopeGlobal) v.scopeGlobal.addEventListener('click', function () { setScope('global'); });
    if (v.scopeChar) v.scopeChar.addEventListener('click', function () { setScope('char'); });

    /* ---- 落库 + 广播：与世界书感知同一套双通道，跨标签页实时同步 ---- */
    function persistGlobal() {
      dbSet(globalKey, state.boundGlobal == null ? null : { voiceId: state.boundGlobal });
      broadcastVoiceChange(globalKey);
    }
    function persistChar() {
      dbSet(charKey, state.boundChar === undefined ? null : { voiceId: state.boundChar, unbound: state.boundChar === null });
      broadcastVoiceChange(charKey);
    }
    function broadcastVoiceChange(key) {
      try {
        if ('BroadcastChannel' in window) {
          var bc = new BroadcastChannel(VOICE_CHANNEL);
          bc.postMessage({ key: key, ts: Date.now() });
          bc.close();
        }
      } catch (e) {}
      try { localStorage.setItem(VOICE_PING_KEY, JSON.stringify({ key: key, ts: Date.now() })); } catch (e) {}
    }

    /* ---- 选择一枚音色：面板内单选，选空值（"跟随系统默认"那一行）
       即为解绑/跟随 ---- */
    function selectVoice(voiceId) {
      if (state.scope === 'global') {
        state.boundGlobal = voiceId || null;
        persistGlobal();
      } else {
        state.boundChar = voiceId || null;
        persistChar();
      }
      renderAll();
      showVoiceToast(voiceId ? '已绑定该音色' : (state.scope === 'char' ? '已回退跟随全局音色' : '已回退跟随系统默认'));
    }

    /* ---- 解除本轨绑定：char 轨回退为「跟随全局」；global 轨回退为「跟随系统默认」 ---- */
    if (v.unbindBtn) {
      v.unbindBtn.addEventListener('click', function () {
        if (state.scope === 'global') {
          state.boundGlobal = null;
          persistGlobal();
        } else {
          state.boundChar = undefined;
          dbSet(charKey, null);
          broadcastVoiceChange(charKey);
        }
        renderAll();
        showVoiceToast(state.scope === 'char' ? '已回退跟随全局音色' : '已回退跟随系统默认');
      });
    }

    function escVoiceHtml(s) {
      return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /* ---- 顶部回执牌：即时反映本轨最终生效的那一枚音色，
       未绑定时如实标注「跟随全局」或「跟随系统默认」，不假装已绑定 ---- */
    function renderCurrent() {
      var boundId = activeBoundId();
      var voice = findVoice(boundId);
      if (voice) {
        v.currentName.textContent = voice.voice_name || voice.voice_id;
        v.currentMeta.textContent = 'Voice ID：' + voice.voice_id;
        v.currentTag.hidden = false;
        v.currentTag.textContent = isFollowingGlobal() ? '跟随全局' : '本轨生效';
      } else {
        v.currentName.textContent = '跟随系统默认';
        v.currentMeta.textContent = state.scope === 'char' && !isFollowingGlobal()
          ? '本轨已明确解绑，不使用任何专属音色'
          : '尚未绑定专属音色，将使用「语音模型」页当前配置的音色';
        v.currentTag.hidden = true;
      }
    }

    /* ---- 触发牌渲染：只负责「有没有音色可选」这一层——账号目录
       为空时隐藏触发牌、只显示空态引导；目录非空时隐藏空态、只显示
       触发牌，二者互斥，绝不同时出现 ---- */
    function renderTrigger() {
      var boundId = activeBoundId();
      var empty = catalogIsEmpty();

      v.trigger.hidden = empty;
      v.empty.hidden = !empty;
      if (empty) {
        v.quickrow.hidden = true;
        return;
      }
      v.quickrow.hidden = (boundId == null && !(state.scope === 'char' && state.boundChar === null));

      var voice = findVoice(boundId);
      v.triggerLabel.textContent = voice ? (voice.voice_name || voice.voice_id) : '跟随系统默认';
    }

    var CAT_LABEL = { system: '系统音色', voice_cloning: '克隆音色', voice_generation: '捏音色' };

    /* ---- 弹层面板渲染：分类 tab + 搜索关键字共同过滤，按分组打
       标签展示，列表本身在固定高度的面板内滚动，绝不撑大或溢出页面 ---- */
    function renderPanelList() {
      var boundId = activeBoundId();
      var q = panelQuery.trim().toLowerCase();

      function matches(item) {
        if (!q) return true;
        var name = (item.voice_name || '').toLowerCase();
        var id = (item.voice_id || '').toLowerCase();
        return name.indexOf(q) !== -1 || id.indexOf(q) !== -1;
      }

      var groups = [];
      if (panelCat === 'all' || panelCat === 'system') groups.push(['system', catalog.system.filter(matches)]);
      if (panelCat === 'all' || panelCat === 'voice_cloning') groups.push(['voice_cloning', catalog.voice_cloning.filter(matches)]);
      if (panelCat === 'all' || panelCat === 'voice_generation') groups.push(['voice_generation', catalog.voice_generation.filter(matches)]);

      var showDefaultRow = !q && (panelCat === 'all');
      var totalMatched = groups.reduce(function (n, g) { return n + g[1].length; }, 0);

      var html = '';
      if (showDefaultRow) {
        var defSel = !boundId;
        html += '<div class="cst-voice-panel-item' + (defSel ? ' is-selected' : '') + '" data-voice-id="" role="option" aria-selected="' + defSel + '">' +
          '<span class="cst-voice-panel-item-radio" aria-hidden="true"></span>' +
          '<span class="cst-voice-panel-item-body"><span class="cst-voice-panel-item-name">跟随系统默认</span>' +
          '<span class="cst-voice-panel-item-id">不使用任何专属音色预设</span></span></div>';
      }

      groups.forEach(function (g) {
        var cat = g[0], items = g[1];
        if (!items.length) return;
        if (panelCat === 'all') html += '<div class="cst-voice-panel-group-label">' + escVoiceHtml(CAT_LABEL[cat]) + '</div>';
        items.forEach(function (item) {
          var sel = item.voice_id === boundId;
          html += '<div class="cst-voice-panel-item' + (sel ? ' is-selected' : '') + '" data-voice-id="' + escVoiceHtml(item.voice_id) + '" role="option" aria-selected="' + sel + '">' +
            '<span class="cst-voice-panel-item-radio" aria-hidden="true"></span>' +
            '<span class="cst-voice-panel-item-body"><span class="cst-voice-panel-item-name">' + escVoiceHtml(item.voice_name || item.voice_id) + '</span>' +
            '<span class="cst-voice-panel-item-id">Voice ID：' + escVoiceHtml(item.voice_id) + '</span></span></div>';
        });
      });

      v.panelList.innerHTML = html;
      var nothingAtAll = totalMatched === 0 && !showDefaultRow;
      v.panelNoRes.hidden = !nothingAtAll;
      v.panelList.hidden = nothingAtAll;
    }

    function openPanel() {
      if (catalogIsEmpty()) return;
      panelCat = 'all';
      panelQuery = '';
      if (v.panelSearch) v.panelSearch.value = '';
      Array.prototype.forEach.call(v.panelTabs.querySelectorAll('.cst-voice-panel-tab'), function (btn) {
        btn.classList.toggle('is-active', btn.getAttribute('data-cat') === 'all');
      });
      renderPanelList();
      v.panelMask.hidden = false;
      requestAnimationFrame(function () {
        v.panelMask.classList.add('is-open');
      });
      v.trigger.classList.add('is-open');
      v.trigger.setAttribute('aria-expanded', 'true');
    }
    function closePanel() {
      v.panelMask.classList.remove('is-open');
      v.trigger.classList.remove('is-open');
      v.trigger.setAttribute('aria-expanded', 'false');
      setTimeout(function () { v.panelMask.hidden = true; }, 280);
    }

    if (v.trigger) v.trigger.addEventListener('click', openPanel);
    if (v.panelClose) v.panelClose.addEventListener('click', closePanel);
    if (v.panelMask) {
      v.panelMask.addEventListener('click', function (e) {
        if (e.target === v.panelMask) closePanel();
      });
    }
    if (v.panelSearch) {
      v.panelSearch.addEventListener('input', function () {
        panelQuery = v.panelSearch.value;
        renderPanelList();
      });
    }
    if (v.panelTabs) {
      v.panelTabs.addEventListener('click', function (e) {
        var btn = e.target.closest('.cst-voice-panel-tab');
        if (!btn) return;
        panelCat = btn.getAttribute('data-cat');
        Array.prototype.forEach.call(v.panelTabs.querySelectorAll('.cst-voice-panel-tab'), function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        renderPanelList();
      });
    }
    if (v.panelList) {
      v.panelList.addEventListener('click', function (e) {
        var item = e.target.closest('.cst-voice-panel-item');
        if (!item) return;
        selectVoice(item.getAttribute('data-voice-id') || '');
        closePanel();
      });
    }

    function renderAll() {
      renderCurrent();
      renderTrigger();
      if (v.panelMask && !v.panelMask.hidden) renderPanelList();
    }

    var _voiceToastTimer = null;
    function showVoiceToast(text) {
      var toastEl = document.getElementById('cstToastText');
      var wrapEl = document.getElementById('cstToast');
      if (!toastEl || !wrapEl) return;
      toastEl.textContent = text;
      wrapEl.classList.add('is-open');
      wrapEl.setAttribute('aria-hidden', 'false');
      clearTimeout(_voiceToastTimer);
      _voiceToastTimer = setTimeout(function () {
        wrapEl.classList.remove('is-open');
        wrapEl.setAttribute('aria-hidden', 'true');
      }, 1800);
    }

    /* ---- 初始加载：读账号音色目录 + 两套已保存的绑定 ---- */
    function loadAll() {
      return Promise.all([
        Promise.resolve(readCatalog()),
        dbGet(globalKey),
        dbGet(charKey)
      ]).then(function (res) {
        catalog = res[0];
        state.boundGlobal = (res[1] && res[1].voiceId) ? res[1].voiceId : null;
        if (res[2] === null || res[2] === undefined) {
          state.boundChar = undefined;
        } else if (res[2].unbound) {
          state.boundChar = null;
        } else {
          state.boundChar = res[2].voiceId || undefined;
        }
      });
    }
    loadAll().then(function () { setScope('global'); });

    /* ---- 跨标签页同步：语音模型页拉取/更新了账号音色目录，或其它
       标签页调整了绑定时，本页重新读取一次，保持三端数据一致 ---- */
    window.addEventListener('storage', function (e) {
      if (e.key === 'luna_voice_catalog' || e.key === VOICE_PING_KEY) {
        catalog = readCatalog();
        renderAll();
      }
    });
    try {
      if ('BroadcastChannel' in window) {
        var bcListen = new BroadcastChannel(VOICE_CHANNEL);
        bcListen.onmessage = function () {
          loadAll().then(renderAll);
        };
      }
    } catch (e) {}

    /* ---- 每次这个语音设置模块被重新展开/进入时，都强制重新读一次
       luna_voice_catalog，而不是只信任页面打开那一刻的旧结果 ---- */
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { catalog = readCatalog(); renderAll(); }
    });
    window.addEventListener('pageshow', function () { catalog = readCatalog(); renderAll(); });
  }

  /* ==========================================================================
     翻译设置 · 双语月鉴 —— 决定本聊天室消息是否附带译文，与语音设置
     同一套 全局 / 仅此角色 双轨绑定 + LunaDB 落库 + BroadcastChannel
     跨标签页广播的逻辑骨架，专属新增：
       1) 总开关（默认关闭，关闭时展开区域整体收起、不落任何语言选择）
       2) 语言库（规范书面语言，不含方言分支；中文仅简体中文 / 粤语）
       3) 气泡样式二选一（点按显影 / 原译并陈）+ 可交互实时预览
     三项均未完成时的状态回执如实呈现，不假装配置已经生效。
  ========================================================================== */
  var TR_CHANNEL = 'luna_translation_link_channel';
  var TR_PING_KEY = 'luna_translation_link_ping';

  /* ---- 语言库：规范书面语言 + 母语自称，分「中文 / 亚洲 / 欧洲 / 其他」
       四组，供分类 tab 筛选；中文组只保留简体中文与粤语两项，不下探
       任何地方方言分支 ---- */
  var TR_LANGUAGES = [
    { code:'zh-CN', name:'简体中文', native:'简体中文', group:'zh' },
    { code:'yue',   name:'粤语',     native:'粵語',     group:'zh' },
    { code:'en',    name:'英语',     native:'English',  group:'asia' },
    { code:'ja',    name:'日语',     native:'日本語',   group:'asia' },
    { code:'ko',    name:'韩语',     native:'한국어',   group:'asia' },
    { code:'vi',    name:'越南语',   native:'Tiếng Việt', group:'asia' },
    { code:'th',    name:'泰语',     native:'ภาษาไทย',  group:'asia' },
    { code:'id',    name:'印尼语',   native:'Bahasa Indonesia', group:'asia' },
    { code:'ms',    name:'马来语',   native:'Bahasa Melayu', group:'asia' },
    { code:'hi',    name:'印地语',   native:'हिन्दी',    group:'asia' },
    { code:'fr',    name:'法语',     native:'Français', group:'europe' },
    { code:'de',    name:'德语',     native:'Deutsch',  group:'europe' },
    { code:'es',    name:'西班牙语', native:'Español',  group:'europe' },
    { code:'pt',    name:'葡萄牙语', native:'Português', group:'europe' },
    { code:'it',    name:'意大利语', native:'Italiano', group:'europe' },
    { code:'ru',    name:'俄语',     native:'Русский',  group:'europe' },
    { code:'nl',    name:'荷兰语',   native:'Nederlands', group:'europe' },
    { code:'pl',    name:'波兰语',   native:'Polski',   group:'europe' },
    { code:'tr',    name:'土耳其语', native:'Türkçe',   group:'more' },
    { code:'ar',    name:'阿拉伯语', native:'العربية',   group:'more' }
  ];

  function trLangByCode(code) {
    for (var i = 0; i < TR_LANGUAGES.length; i++) { if (TR_LANGUAGES[i].code === code) return TR_LANGUAGES[i]; }
    return null;
  }

  function initTranslationLink(session) {
    var t = {
      masterRow: document.getElementById('cstTrMasterRow'),
      masterSub: document.getElementById('cstTrMasterSub'),
      swt: document.getElementById('cstTrSwitch'),
      panel: document.getElementById('cstTrPanel'),

      scopeGlobal: document.getElementById('cstTrScopeGlobal'),
      scopeChar: document.getElementById('cstTrScopeChar'),
      scopeHint: document.getElementById('cstTrScopeHint'),

      sourceCard: document.getElementById('cstTrSourceCard'),
      sourceValue: document.getElementById('cstTrSourceValue'),
      targetCard: document.getElementById('cstTrTargetCard'),
      targetValue: document.getElementById('cstTrTargetValue'),
      swapBtn: document.getElementById('cstTrSwapBtn'),

      langPanelMask: document.getElementById('cstTrLangPanelMask'),
      langPanel: document.getElementById('cstTrLangPanel'),
      langPanelTitleCn: document.getElementById('cstTrLangPanelTitleCn'),
      langPanelTitleEn: document.getElementById('cstTrLangPanelTitleEn'),
      langPanelClose: document.getElementById('cstTrLangPanelClose'),
      langPanelSearch: document.getElementById('cstTrLangPanelSearch'),
      langPanelTabs: document.getElementById('cstTrLangPanelTabs'),
      langPanelList: document.getElementById('cstTrLangPanelList'),
      langPanelNoRes: document.getElementById('cstTrLangPanelNoRes'),

      styleTap: document.getElementById('cstTrStyleTap'),
      styleBoth: document.getElementById('cstTrStyleBoth'),

      previewBubble: document.getElementById('cstTrPreviewBubble'),
      previewOrig: document.getElementById('cstTrPreviewOrig'),
      previewTrans: document.getElementById('cstTrPreviewTrans'),
      previewDivider: document.getElementById('cstTrPreviewDivider'),
      previewTapHint: document.getElementById('cstTrPreviewTapHint'),
      previewFoot: document.getElementById('cstTrPreviewFoot'),
      previewAvatar: document.getElementById('cstTrPreviewAvatar'),
      previewAvatarGlyph: document.getElementById('cstTrPreviewAvatarGlyph'),

      statusCard: document.getElementById('cstTrStatusCard'),
      statusText: document.getElementById('cstTrStatusText'),

      quickrow: document.getElementById('cstTrQuickrow'),
      unbindBtn: document.getElementById('cstTrUnbindBtn')
    };
    if (!t.swt) return;

    /* ---- 预览气泡头像同步：与羁绊印鉴的 renderCharPlate 取值口径一致——
         优先角色档案头像图，否则退化为昵称首字，绝不写死占位字，
         避免「实时预览」和聊天室实际显示的头像/昵称脱节 ---- */
    function syncPreviewAvatar(charRecord) {
      if (!t.previewAvatar) return;
      var name = (charRecord && charRecord.name) || (session && session.name) || '';
      var avatarSrc = charRecord && (charRecord.avatar || charRecord.avatarImg);
      if (avatarSrc) {
        t.previewAvatar.innerHTML = '<img class="cst-tr-preview-avatar-img" src="' + String(avatarSrc).replace(/"/g, '&quot;') + '" alt="" />';
      } else {
        t.previewAvatar.innerHTML = '<span class="cst-tr-preview-avatar-glyph" id="cstTrPreviewAvatarGlyph">' +
          (name ? name[0].toUpperCase() : '友') + '</span>';
      }
    }
    syncPreviewAvatar(null);
    if (typeof getAllBondChars === 'function' && session) {
      getAllBondChars().then(function (chars) {
        var charRecord = findBondCharRecord(chars, session);
        if (charRecord) syncPreviewAvatar(charRecord);
      }).catch(function () {});
    }

    var globalKey = 'translationLink:global';
    var charKey = 'translationLink:' + (session && session.charId != null ? ('char-' + session.charId) : ('name-' + (session && session.name)));
    var _trToastTimer = null;

    var langPanelCat = 'all';
    var langPanelQuery = '';
    var langPanelTarget = null; // 'source' | 'target'，标记当前弹层是为谁选

    /* ---- 双语示例句：用于实时预览，源语言变化时优先取该语言对应的
         示例原文，否则回退中文原句；译文语言变化时同理。
         必须覆盖 TR_LANGS 里全部可选语言——此前只写了 9 种，
         选到泰语/越南语/印尼语等未覆盖的语言时 sampleFor 会静默
         回退成中文例句，导致「原文中文、译文也中文」这种明显不对
         的预览（用户反馈的正是这个问题）。现在每个可选语言都有
         对应例句，不再有回退到中文的情况。 */
    var TR_SAMPLE = {
      'zh-CN': '今天月色真好，要不要一起走走？',
      'yue':   '今晚啲月光几靓喎，一齐去行下啦？',
      'en':    'The moon\u2019s lovely tonight \u2014 want to take a walk together?',
      'ja':    '今夜は月がとても綺麗だね、一緒に散歩しない？',
      'ko':    '오늘 밤 달이 참 예쁘네, 같이 산책할래?',
      'vi':    'T\u1ed1i nay tr\u0103ng \u0111\u1eb9p qu\u00e1, mình \u0111i d\u1ea1o nh\u00e9?',
      'th':    '\u0e04\u0e37\u0e19\u0e19\u0e35\u0e49\u0e14\u0e27\u0e07\u0e08\u0e31\u0e19\u0e17\u0e23\u0e4c\u0e2a\u0e27\u0e22\u0e08\u0e31\u0e07\u0e40\u0e25\u0e22 \u0e44\u0e1b\u0e40\u0e14\u0e34\u0e19\u0e40\u0e25\u0e48\u0e19\u0e14\u0e49\u0e27\u0e22\u0e01\u0e31\u0e19\u0e44\u0e2b\u0e21?',
      'id':    'Malam ini bulannya indah sekali, mau jalan-jalan bareng?',
      'ms':    'Malam ini bulan sangat cantik, mahu berjalan-jalan bersama?',
      'hi':    '\u0906\u091c \u0930\u093e\u0924 \u091a\u093e\u0901\u0926 \u092c\u0939\u0941\u0924 \u0916\u0942\u092c\u0938\u0942\u0930\u0924 \u0939\u0948, \u0938\u093e\u0925 \u092e\u0947\u0902 \u091f\u0939\u0932\u0928\u0947 \u091a\u0932\u0947\u0902?',
      'fr':    'La lune est magnifique ce soir, on va se promener ?',
      'de':    'Der Mond ist heute Abend wundersch\u00f6n \u2014 wollen wir spazieren gehen?',
      'es':    '\u00a1Qu\u00e9 hermosa est\u00e1 la luna esta noche! \u00bfVamos a caminar?',
      'pt':    'A lua est\u00e1 linda esta noite, vamos dar um passeio juntos?',
      'it':    'La luna \u00e8 bellissima stasera, vogliamo fare una passeggiata insieme?',
      'ru':    '\u0421\u0435\u0433\u043e\u0434\u043d\u044f \u043e\u0447\u0435\u043d\u044c \u043a\u0440\u0430\u0441\u0438\u0432\u0430\u044f \u043b\u0443\u043d\u0430, \u043f\u0440\u043e\u0433\u0443\u043b\u044f\u0435\u043c\u0441\u044f?',
      'nl':    'De maan is vanavond prachtig, zullen we samen een wandeling maken?',
      'pl':    'Ksi\u0119\u017cyc jest dzi\u015b pi\u0119kny, przejdziemy si\u0119 razem?',
      'tr':    'Bu gece ay \u00e7ok g\u00fczel, birlikte y\u00fcr\u00fcy\u00fc\u015fe \u00e7\u0131kal\u0131m m\u0131?',
      'ar':    '\u0627\u0644\u0642\u0645\u0631 \u062c\u0645\u064a\u0644 \u0627\u0644\u0644\u064a\u0644\u0629\u060c \u0647\u0644 \u0646\u0630\u0647\u0628 \u0641\u064a \u0646\u0632\u0647\u0629\u061f'
    };
    function sampleFor(code) { return TR_SAMPLE[code] || TR_SAMPLE['zh-CN']; }

    var state = {
      scope: 'global',
      // 每一轨各自持有一份完整配置对象：
      // { enabled, source, target, style } —— style: 'tap' | 'both'
      // global 轨没有「未设置」概念，直接就是默认对象；
      // char 轨 undefined = 未单独设置，跟随 global
      boundGlobal: { enabled:false, source:null, target:null, style:'both' },
      boundChar: undefined,
      revealed: false // 预览气泡在「点按显影」样式下的展开态，仅预览用，不落库
    };

    function activeConfig() {
      if (state.scope === 'char') {
        return state.boundChar !== undefined ? state.boundChar : state.boundGlobal;
      }
      return state.boundGlobal;
    }
    function isFollowingGlobal() {
      return state.scope === 'char' && state.boundChar === undefined;
    }
    function currentDraft() {
      // 当前作用域下真正要被编辑落库的那一份对象；char 轨若仍在跟随
      // 全局，则从 global 派生一份新对象作为该轨的起始值（视为"从这里
      // 开始单独设置"），而不是直接改写 global 本身
      if (state.scope === 'char') {
        if (state.boundChar === undefined) {
          state.boundChar = { enabled: state.boundGlobal.enabled, source: state.boundGlobal.source, target: state.boundGlobal.target, style: state.boundGlobal.style };
        }
        return state.boundChar;
      }
      return state.boundGlobal;
    }

    function persist() {
      dbSet(globalKey, state.boundGlobal);
      dbSet(charKey, state.boundChar === undefined ? null : state.boundChar);
      broadcastChange();
    }
    function broadcastChange() {
      try {
        if ('BroadcastChannel' in window) {
          var bc = new BroadcastChannel(TR_CHANNEL);
          bc.postMessage({ ts: Date.now() });
          bc.close();
        }
      } catch (e) {}
      try { localStorage.setItem(TR_PING_KEY, JSON.stringify({ ts: Date.now() })); } catch (e) {}
    }

    function setScope(scope) {
      state.scope = scope;
      t.scopeGlobal.classList.toggle('is-active', scope === 'global');
      t.scopeChar.classList.toggle('is-active', scope === 'char');
      t.scopeHint.textContent = scope === 'global'
        ? '应用于所有未单独设置的聊天室'
        : (state.boundChar !== undefined
            ? ('仅应用于「' + (session.name || '这位好友') + '」的聊天室，优先于全局翻译设置')
            : ('「' + (session.name || '这位好友') + '」尚未单独设置，当前跟随全局翻译设置——调整任意一项即为此角色单独设置')
          );
      t.quickrow.hidden = !(scope === 'char' && state.boundChar !== undefined);
      renderAll();
    }
    if (t.scopeGlobal) t.scopeGlobal.addEventListener('click', function () { setScope('global'); });
    if (t.scopeChar) t.scopeChar.addEventListener('click', function () { setScope('char'); });

    /* ---- 总开关：默认关闭；关闭时展开区收起且不清空已选语言/样式，
         方便用户「先配置好、再决定何时启用」，也方便临时关闭后一键
         恢复原有配置，而不必重新选一遍 ---- */
    function setMasterSwitch(on) {
      var cfg = currentDraft();
      cfg.enabled = on;
      t.swt.setAttribute('aria-checked', on ? 'true' : 'false');
      t.panel.classList.toggle('is-open', on);
      t.masterSub.textContent = on ? '当前开启 · 消息将附带译文' : '当前关闭 · 消息仅显示原文';
      if (state.scope === 'global') { persist(); } else { persist(); }
      renderAll();
    }
    if (t.swt) {
      t.swt.addEventListener('click', function () {
        setMasterSwitch(t.swt.getAttribute('aria-checked') !== 'true');
      });
    }

    /* ---- 语言弹层：分组 tab + 搜索，点选后写回当前作用域草稿 ---- */
    function openLangPanel(which) {
      langPanelTarget = which;
      langPanelCat = 'all';
      langPanelQuery = '';
      if (t.langPanelSearch) t.langPanelSearch.value = '';
      var tabs = t.langPanelTabs.querySelectorAll('.cst-voice-panel-tab');
      for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('is-active', tabs[i].getAttribute('data-cat') === 'all');
      t.langPanelTitleCn.textContent = which === 'source' ? '选择原文语言' : '选择译文语言';
      t.langPanelTitleEn.textContent = which === 'source' ? 'SOURCE\u00a0LANGUAGE' : 'TARGET\u00a0LANGUAGE';
      renderLangList();
      t.langPanelMask.hidden = false;
      requestAnimationFrame(function () { t.langPanelMask.classList.add('is-open'); });
    }
    function closeLangPanel() {
      t.langPanelMask.classList.remove('is-open');
      setTimeout(function () { t.langPanelMask.hidden = true; }, 280);
    }
    if (t.langPanelClose) t.langPanelClose.addEventListener('click', closeLangPanel);
    if (t.langPanelMask) t.langPanelMask.addEventListener('click', function (e) { if (e.target === t.langPanelMask) closeLangPanel(); });
    if (t.langPanelTabs) {
      t.langPanelTabs.addEventListener('click', function (e) {
        var btn = e.target.closest('.cst-voice-panel-tab');
        if (!btn) return;
        langPanelCat = btn.getAttribute('data-cat');
        var tabs = t.langPanelTabs.querySelectorAll('.cst-voice-panel-tab');
        for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('is-active', tabs[i] === btn);
        renderLangList();
      });
    }
    if (t.langPanelSearch) {
      t.langPanelSearch.addEventListener('input', function () {
        langPanelQuery = t.langPanelSearch.value.trim().toLowerCase();
        renderLangList();
      });
    }
    function renderLangList() {
      var list = TR_LANGUAGES.filter(function (l) {
        var catOk = langPanelCat === 'all' || l.group === langPanelCat;
        var q = langPanelQuery;
        var qOk = !q || l.name.toLowerCase().indexOf(q) !== -1 || l.native.toLowerCase().indexOf(q) !== -1 || l.code.toLowerCase().indexOf(q) !== -1;
        return catOk && qOk;
      });
      t.langPanelList.innerHTML = '';
      t.langPanelNoRes.hidden = list.length > 0;
      var cfg = currentDraft();
      var selectedCode = langPanelTarget === 'source' ? cfg.source : cfg.target;
      list.forEach(function (l) {
        var row = document.createElement('div');
        row.className = 'cst-tr-lang-row-item' + (l.code === selectedCode ? ' is-selected' : '');
        row.innerHTML =
          '<span class="cst-tr-lang-row-radio" aria-hidden="true"></span>' +
          '<span class="cst-tr-lang-row-name"></span>' +
          '<span class="cst-tr-lang-row-native"></span>';
        row.querySelector('.cst-tr-lang-row-name').textContent = l.name;
        row.querySelector('.cst-tr-lang-row-native').textContent = l.native;
        row.addEventListener('click', function () {
          var draft = currentDraft();
          if (langPanelTarget === 'source') draft.source = l.code; else draft.target = l.code;
          persist();
          renderAll();
          closeLangPanel();
        });
        t.langPanelList.appendChild(row);
      });
    }
    if (t.sourceCard) t.sourceCard.addEventListener('click', function () { openLangPanel('source'); });
    if (t.targetCard) t.targetCard.addEventListener('click', function () { openLangPanel('target'); });

    if (t.swapBtn) {
      t.swapBtn.addEventListener('click', function () {
        var draft = currentDraft();
        var tmp = draft.source; draft.source = draft.target; draft.target = tmp;
        persist();
        renderAll();
      });
    }

    /* ---- 气泡样式：二选一，选中即落库并刷新预览 ---- */
    function setStyle(style) {
      var draft = currentDraft();
      draft.style = style;
      persist();
      state.revealed = false;
      renderAll();
    }
    if (t.styleTap) t.styleTap.addEventListener('click', function () { setStyle('tap'); });
    if (t.styleBoth) t.styleBoth.addEventListener('click', function () { setStyle('both'); });

    /* ---- 预览气泡本身可点击：只在「点按显影」样式下有意义，体验一次
         真实的展开/收起动画，不落库、纯预览态 ---- */
    if (t.previewBubble) {
      t.previewBubble.addEventListener('click', function () {
        var cfg = activeConfig();
        if (cfg.style !== 'tap') return;
        state.revealed = !state.revealed;
        renderPreview();
      });
    }
    if (t.previewTapHint) {
      t.previewTapHint.addEventListener('click', function (e) {
        e.stopPropagation();
        state.revealed = true;
        renderPreview();
      });
    }

    /* ---- 解除本轨绑定：char 轨回退为「跟随全局」 ---- */
    if (t.unbindBtn) {
      t.unbindBtn.addEventListener('click', function () {
        state.boundChar = undefined;
        persist();
        setScope('char');
        showTrToast('已回退跟随全局翻译设置');
      });
    }

    function renderPreview() {
      var cfg = activeConfig();
      var srcCode = cfg.source || 'zh-CN';
      var tgtCode = cfg.target || (srcCode === 'en' ? 'zh-CN' : 'en');
      t.previewOrig.textContent = sampleFor(srcCode);
      t.previewTrans.textContent = sampleFor(tgtCode);

      t.previewBubble.classList.toggle('style-tap', cfg.style === 'tap');
      t.previewBubble.classList.toggle('style-both', cfg.style !== 'tap');
      var revealed = cfg.style !== 'tap' || state.revealed;
      t.previewBubble.classList.toggle('is-revealed', cfg.style === 'tap' && state.revealed);

      /* 换一种更保险的写法：不再依赖 CSS 选择器
         .cst-tr-bubble.style-tap .cst-tr-bubble-divider 这类后代规则
         去隐藏/显示分隔线与译文——万一被别的规则覆盖、或者特异性/
         加载顺序出问题，这种写法很难排查。这里直接用 JS 读写
         行内 style.display，内联样式优先级最高，不会被任何
         class 选择器覆盖，「点按显影」未展开时分隔线与译文
         保证不占据任何布局空间。 */
      t.previewDivider.style.display = revealed ? '' : 'none';
      t.previewTrans.style.display = revealed ? '' : 'none';
      if (t.previewTapHint) {
        t.previewTapHint.hidden = !(cfg.style === 'tap' && !state.revealed);
      }

      if (cfg.style === 'tap') {
        t.previewFoot.textContent = '此为「点按显影」样式预览 · 点一下气泡试试展开译文，再点一下收起';
      } else {
        t.previewFoot.textContent = '此为「原译并陈」样式预览 · 原文与译文同时展示在同一枚气泡内';
      }
    }

    function renderAll() {
      var cfg = activeConfig();

      // 总开关 + 展开区
      t.swt.setAttribute('aria-checked', cfg.enabled ? 'true' : 'false');
      t.panel.classList.toggle('is-open', !!cfg.enabled);
      t.masterSub.textContent = cfg.enabled
        ? (isFollowingGlobal() ? '跟随全局 · 当前开启' : '当前开启 · 消息将附带译文')
        : (isFollowingGlobal() ? '跟随全局 · 当前关闭' : '当前关闭 · 消息仅显示原文');

      // 语言卡
      var srcLang = trLangByCode(cfg.source);
      var tgtLang = trLangByCode(cfg.target);
      t.sourceValue.textContent = srcLang ? srcLang.name : '未选择';
      t.sourceCard.classList.toggle('is-set', !!srcLang);
      t.targetValue.textContent = tgtLang ? tgtLang.name : '未选择';
      t.targetCard.classList.toggle('is-set', !!tgtLang);

      // 样式卡
      t.styleTap.classList.toggle('is-active', cfg.style === 'tap');
      t.styleBoth.classList.toggle('is-active', cfg.style !== 'tap');

      renderPreview();

      // 配置完整性回执：语言二选没配完 / 或干脆总开关未开，都如实说明
      var missing = [];
      if (!cfg.source) missing.push('原文语言');
      if (!cfg.target) missing.push('译文语言');
      var complete = missing.length === 0;
      t.statusCard.classList.toggle('is-complete', complete);
      if (!cfg.enabled) {
        t.statusText.textContent = complete
          ? '语言已选好，样式为「' + (cfg.style === 'tap' ? '点按显影' : '原译并陈') + '」，开启总开关后即可生效'
          : ('翻译当前关闭；开启前还需选择' + missing.join('与'));
      } else if (!complete) {
        t.statusText.textContent = '尚未选择' + missing.join('与') + '，翻译暂不会生效';
      } else {
        t.statusText.textContent = '已配置完整：' + (srcLang ? srcLang.name : '') + ' → ' + (tgtLang ? tgtLang.name : '') + ' · ' + (cfg.style === 'tap' ? '点按显影' : '原译并陈') + (isFollowingGlobal() ? '（跟随全局）' : '');
      }
    }

    function showTrToast(text) {
      var toastEl = document.getElementById('cstToastText');
      var wrapEl = document.getElementById('cstToast');
      if (!toastEl || !wrapEl) return;
      toastEl.textContent = text;
      wrapEl.classList.add('is-open');
      wrapEl.setAttribute('aria-hidden', 'false');
      clearTimeout(_trToastTimer);
      _trToastTimer = setTimeout(function () {
        wrapEl.classList.remove('is-open');
        wrapEl.setAttribute('aria-hidden', 'true');
      }, 1800);
    }

    function loadAll() {
      return Promise.all([
        dbGet(globalKey),
        dbGet(charKey)
      ]).then(function (res) {
        state.boundGlobal = res[0] || { enabled:false, source:null, target:null, style:'both' };
        state.boundChar = res[1] || undefined;
      });
    }
    loadAll().then(function () { setScope('global'); });

    /* ---- 跨标签页同步：与语音设置同一套双通道 ---- */
    window.addEventListener('storage', function (e) {
      if (e.key === TR_PING_KEY) { loadAll().then(renderAll); }
    });
    try {
      if ('BroadcastChannel' in window) {
        var bcListen = new BroadcastChannel(TR_CHANNEL);
        bcListen.onmessage = function () { loadAll().then(renderAll); };
      }
    } catch (e) {}
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { loadAll().then(renderAll); }
    });
    window.addEventListener('pageshow', function () { loadAll().then(renderAll); });
  }

  /* ==========================================================================
     记录设置 · 聊天记录 / 通话记录 —— 两枚跳转入口
     - href 携带 charId / name 冗余参数，供 chatlog.html / calllog.html
       在 sessionStorage 会话令牌之外做二次核对（同一套判定口径），
       即使令牌因某种原因缺失，也能给出更精确的引导，而不是笼统拦截。
     - 聊天记录条的数量徽标读取与 chatroom.js 完全同源的
       LunaDB key（chatroom:char-<id> / chatroom:name-<name>），
       如实显示当前消息条数；为 0 时如实显示「暂无记录」，不编造。
     - 通话记录条目前没有真实数据源，副行与徽标保持「筹备中」/
       「敬请期待」的诚实占位状态，不假装已有数据。
  ========================================================================== */
  function initRecordLink(session) {
    var chatRow = document.getElementById('cstRecordChatRow');
    var chatSub = document.getElementById('cstRecordChatSub');
    var chatBadge = document.getElementById('cstRecordChatBadge');
    var callRow = document.getElementById('cstRecordCallRow');
    var callSub = document.getElementById('cstRecordCallSub');
    if (!chatRow && !callRow) return;

    var idPart = session && session.charId != null ? ('id=' + encodeURIComponent(session.charId)) : '';
    var namePart = session && session.name ? ('name=' + encodeURIComponent(session.name)) : '';
    var query = [idPart, namePart].filter(Boolean).join('&');

    if (chatRow) chatRow.href = query ? ('chatlog.html?' + query) : 'chatlog.html';
    if (callRow) callRow.href = query ? ('calllog.html?' + query) : 'calllog.html';

    if (!session) return;

    var storeKey = 'chatroom:' + (session.charId != null ? ('char-' + session.charId) : ('name-' + session.name));
    dbGet(storeKey).then(function (list) {
      var count = (list && list.length) || 0;
      if (chatSub) {
        chatSub.textContent = count > 0
          ? ('共 ' + count + ' 条消息 · 点击查看完整记录')
          : '暂无消息记录';
      }
      if (chatBadge) chatBadge.textContent = count > 0 ? String(count) : '暂无';
    }).catch(function () {
      if (chatSub) chatSub.textContent = '暂无消息记录';
      if (chatBadge) chatBadge.textContent = '暂无';
    });

    if (callSub) callSub.textContent = '功能筹备中 · 敬请期待';
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

  /* ---- LunaDB 读写：与 chatroom.js 共用同一个 IndexedDB(luna_chat_db / kv)，
     背景配置体积可能较大（dataURL），LunaDB 底层若为 IndexedDB 实现，
     单条记录存放到几十 MB 都无压力，不会像 localStorage 那样有 5MB 硬限 ---- */
  function dbGet(key) {
    if (window.LunaDB) return window.LunaDB.get(key).then(function (v) { return v || null; });
    return Promise.resolve(null);
  }
  function dbSet(key, value) {
    if (window.LunaDB) return window.LunaDB.set(key, value);
    return Promise.resolve(false);
  }

  /* ==========================================================================
     羁绊印鉴 —— char × user 关联数据读取与渲染
     数据源与 chatroom.js 组装 system prompt 时完全同源：
       LunaCharDB / chars        —— 角色档案
       LunaIdentityDB / identities —— 用户身份卡（含 boundCharIds 绑定关系）
  ========================================================================== */

  /* ---- LunaCharDB / chars ---- */
  var _bondCharDb = null;
  function openBondCharDb() {
    if (_bondCharDb) return Promise.resolve(_bondCharDb);
    return new Promise(function (resolve, reject) {
      var probe = indexedDB.open('LunaCharDB');
      probe.onsuccess = function (e) {
        var cur = e.target.result;
        var ver = cur.version;
        var hasChars = cur.objectStoreNames.contains('chars');
        cur.close();
        if (hasChars) {
          var req2 = indexedDB.open('LunaCharDB', ver);
          req2.onsuccess = function (e2) { _bondCharDb = e2.target.result; resolve(_bondCharDb); };
          req2.onerror = function (e2) { reject(e2.target.error); };
        } else {
          var req3 = indexedDB.open('LunaCharDB', ver + 1);
          req3.onupgradeneeded = function (e3) {
            var db3 = e3.target.result;
            if (!db3.objectStoreNames.contains('chars')) db3.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
          };
          req3.onsuccess = function (e3) { _bondCharDb = e3.target.result; resolve(_bondCharDb); };
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
  function getAllBondChars() {
    return openBondCharDb().catch(function () { return null; }).then(function (db) {
      if (!db || !db.objectStoreNames.contains('chars')) return [];
      return new Promise(function (resolve) {
        var req = db.transaction('chars', 'readonly').objectStore('chars').getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { resolve([]); };
      });
    });
  }

  /* ---- LunaIdentityDB / identities ---- */
  var _bondIdDb = null;
  function openBondIdentityDb() {
    if (_bondIdDb) return Promise.resolve(_bondIdDb);
    return new Promise(function (resolve, reject) {
      var probe = indexedDB.open('LunaIdentityDB');
      probe.onsuccess = function (e) {
        var db = e.target.result;
        if (db.objectStoreNames.contains('identities')) { _bondIdDb = db; resolve(_bondIdDb); return; }
        var ver = db.version + 1; db.close();
        var req2 = indexedDB.open('LunaIdentityDB', ver);
        req2.onupgradeneeded = function (ev) {
          if (!ev.target.result.objectStoreNames.contains('identities')) {
            ev.target.result.createObjectStore('identities', { keyPath: 'id' });
          }
        };
        req2.onsuccess = function (ev) { _bondIdDb = ev.target.result; resolve(_bondIdDb); };
        req2.onerror = function (ev) { reject(ev.target.error); };
      };
      probe.onerror = function (e) { reject(e.target.error); };
    });
  }
  function getAllBondIdentities() {
    return openBondIdentityDb().catch(function () { return null; }).then(function (db) {
      if (!db || !db.objectStoreNames.contains('identities')) return [];
      return new Promise(function (resolve) {
        var req = db.transaction('identities', 'readonly').objectStore('identities').getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { resolve([]); };
      });
    });
  }

  /* ---- 角色档案匹配：优先 charId 精确匹配，退化按名字匹配 —— 与
     chatroom.js 的 loadCharacterRecord 判定逻辑保持一致 ---- */
  function findBondCharRecord(chars, session) {
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
  }

  /* ---- 绑定身份匹配：取「激活且绑定了本角色」的身份卡中，
     优先主身份、其次最近创建 —— 与 chatroom.js 的
     loadBoundUserIdentity 判定逻辑保持一致 ---- */
  function findBondUserIdentity(identities, charId) {
    if (charId == null || !identities || !identities.length) return null;
    var bound = identities.filter(function (idy) {
      if (idy.active === false) return false;
      var ids = Array.isArray(idy.boundCharIds) ? idy.boundCharIds
        : (idy.boundCharId != null ? [idy.boundCharId] : []);
      return ids.indexOf(charId) !== -1;
    });
    if (!bound.length) return null;
    bound.sort(function (a, b) {
      if (!!a.isPrimary !== !!b.isPrimary) return a.isPrimary ? -1 : 1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    return bound[0];
  }

  /* ---- 写入绑定：直接向该身份卡的 boundCharIds 追加当前角色 id，
     与 user.js 表单保存时写入的字段完全一致，走同一个 IndexedDB store，
     所以在这里完成的绑定，聊天室下次组装 AI 上下文时立刻生效 ---- */
  function bindIdentityToChar(identity, charId) {
    return openBondIdentityDb().catch(function () { return null; }).then(function (db) {
      if (!db) return false;
      var ids = Array.isArray(identity.boundCharIds) ? identity.boundCharIds.slice()
        : (identity.boundCharId != null ? [identity.boundCharId] : []);
      if (ids.indexOf(charId) === -1) ids.push(charId);
      var updated = Object.assign({}, identity, { boundCharIds: ids });
      return new Promise(function (resolve) {
        var tx = db.transaction('identities', 'readwrite');
        var req = tx.objectStore('identities').put(updated);
        req.onsuccess = function () { resolve(updated); };
        req.onerror = function () { resolve(false); };
      });
    });
  }

  /* ---- 写入角色档案字段：彼此称呼·角色称（callUser）与 相识情境
     （meetContext）均落在 LunaCharDB / chars 的同一条记录上，
     沿用 charRecord 已有对象直接 put 覆盖，字段名与 chatroom.js
     读取角色档案时使用的字段完全一致，不新造字段名 ---- */
  function updateBondCharField(charRecord, field, value) {
    return openBondCharDb().catch(function () { return null; }).then(function (db) {
      if (!db || charRecord == null) return false;
      var updated = Object.assign({}, charRecord);
      updated[field] = value;
      return new Promise(function (resolve) {
        var tx = db.transaction('chars', 'readwrite');
        var req = tx.objectStore('chars').put(updated);
        req.onsuccess = function () { resolve(updated); };
        req.onerror = function () { resolve(false); };
      });
    });
  }

  /* ---- 写入身份卡字段：用户称呼角色（callChar）与 身份标签（tags）
     落在 LunaIdentityDB / identities 上，与绑定写入 boundCharIds
     使用同一个 store，保存后聊天室下次组装上下文立即生效 ---- */
  function updateBondIdentityField(identity, field, value) {
    return openBondIdentityDb().catch(function () { return null; }).then(function (db) {
      if (!db || identity == null) return false;
      var updated = Object.assign({}, identity);
      updated[field] = value;
      return new Promise(function (resolve) {
        var tx = db.transaction('identities', 'readwrite');
        var req = tx.objectStore('identities').put(updated);
        req.onsuccess = function () { resolve(updated); };
        req.onerror = function () { resolve(false); };
      });
    });
  }

  function escBondHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---- 渲染角色一侧：仅取头像/姓名/定位（role）三项事实，
     不触碰 backstory / prompt / personality / traits 等人设正文字段 ---- */
  function renderCharPlate(els, charRecord, session) {
    var name = (charRecord && charRecord.name) || session.name || '未命名角色';
    els.bondCharName.textContent = name;
    els.bondCharRole.textContent = charRecord && charRecord.role ? charRecord.role : '';

    var avatarSrc = charRecord && (charRecord.avatar || charRecord.avatarImg);
    if (avatarSrc) {
      els.bondCharAvatar.innerHTML = '<img class="cst-bond-avatar-img" src="' + escBondHtml(avatarSrc) + '" alt="" />';
    } else {
      els.bondCharAvatar.innerHTML = '<span class="cst-bond-avatar-glyph">' + escBondHtml(name ? name[0].toUpperCase() : '?') + '</span>';
    }
  }

  /* ---- 渲染用户一侧：绑定成功后填入该身份卡信息，
     绝不用角色人设去填补用户侧信息 ---- */
  function renderUserPlate(els, userIdentity) {
    var name = userIdentity.name || '未命名身份';
    els.bondUserName.textContent = name;
    els.bondUserRole.textContent = userIdentity.role ? userIdentity.role : '';

    if (userIdentity.avatarImg) {
      els.bondUserAvatar.innerHTML = '<img class="cst-bond-avatar-img" src="' + escBondHtml(userIdentity.avatarImg) + '" alt="" />';
      els.bondUserAvatar.style.background = '';
    } else {
      els.bondUserAvatar.innerHTML = '<span class="cst-bond-avatar-glyph">' + escBondHtml(name ? name[0].toUpperCase() : '?') + '</span>';
      els.bondUserAvatar.style.background = userIdentity.avatarColor || '';
    }
  }

  /* ---- 关系向语：单行「角色 视 用户 为 关系」，方向固定为角色对用户的
     认知（与 chatroom.js 组装 system prompt 时「角色应如何看待用户」的
     语义一致）。角色名 / 用户名取各自档案的展示名，关系值取
     charRecord.relation —— 与关系事实条共用同一份原始数据，
     只是渲染位置不同，不重复定义新字段。 ---- */
  function renderBondOrient(els, charRecord, userIdentity, session) {
    if (!els.bondOrientFrom) return;
    var charName = (charRecord && charRecord.name) || session.name || '角色';
    var userName = (userIdentity && userIdentity.name) || (userIdentity ? '该身份' : '待缔结');
    els.bondOrientFrom.textContent = charName;
    els.bondOrientTo.textContent = userName;
    setBondFactValue(els.bondOrientValue, charRecord && charRecord.relation);
  }

  /* ---- 关系事实条：彼此称呼（双向）/ 相识情境 / 用户身份标签 ----
     角色称呼用户 —— charRecord.callUser（沿用既有字段）
     用户称呼角色 —— userIdentity.callChar，取不到则退化到
       userIdentity.addressChar（部分身份卡表单可能用此命名），
       两者都没有才显示「未设置」，不臆造称呼
     相识情境 —— charRecord.meetContext，退化到 charRecord.scenario，
       仅记录事实性背景，不读取 backstory / prompt 等人设正文字段 ---- */
  function renderBondFacts(els, charRecord, userIdentity) {
    setBondFactValue(els.bondFactCallValue, charRecord && charRecord.callUser);

    var userCall = userIdentity && (userIdentity.callChar || userIdentity.addressChar);
    setBondFactValue(els.bondFactUserCallValue, userCall);

    var context = charRecord && (charRecord.meetContext || charRecord.scenario);
    setBondFactValue(els.bondFactContextValue, context);

    var tags = userIdentity && Array.isArray(userIdentity.tags) ? userIdentity.tags : [];
    var tagText = tags.map(function (t) { return t && t.text ? t.text : t; }).filter(Boolean).join('、');
    setBondFactValue(els.bondFactUserTagsValue, tagText);
  }
  function setBondFactValue(el, value) {
    if (!el) return;
    if (value) {
      el.textContent = value;
      el.classList.remove('is-empty');
    } else {
      el.textContent = '未设置';
      el.classList.add('is-empty');
    }
  }

  /* ---- 身份候选行：卡内直接点选完成绑定，点选期间禁用防止重复提交 ---- */
  function buildPickerRow(identity, onPick) {
    var row = document.createElement('div');
    row.className = 'cst-bond-picker-row';

    var avatarInner = identity.avatarImg
      ? '<img src="' + escBondHtml(identity.avatarImg) + '" alt="" />'
      : '<span>' + escBondHtml(identity.name ? identity.name[0].toUpperCase() : '?') + '</span>';

    row.innerHTML =
      '<span class="cst-bond-picker-row-avatar" style="' + (identity.avatarImg ? '' : 'background:' + escBondHtml(identity.avatarColor || '#e4e4e9')) + '">' + avatarInner + '</span>' +
      '<span class="cst-bond-picker-row-info">' +
        '<span class="cst-bond-picker-row-name">' + escBondHtml(identity.name || '未命名身份') + '</span>' +
        '<span class="cst-bond-picker-row-role">' + escBondHtml(identity.role || (identity.isPrimary ? '主身份' : '身份卡')) + '</span>' +
      '</span>' +
      (identity.isPrimary ? '<span class="cst-bond-picker-row-primary">主身份</span>' : '') +
      '<span class="cst-bond-picker-row-arrow"><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 5L16 12L9 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';

    row.addEventListener('click', function () {
      if (row.classList.contains('is-selecting')) return;
      row.classList.add('is-selecting');
      onPick(identity, function () { row.classList.remove('is-selecting'); });
    });
    return row;
  }

  /* ---- 关系事实编辑面板：四个可编辑项共用同一块浮层，按 field 切换
     文案、初始值与保存目标。文本类（角色称 / 用户称 / 相识情境）用
     单行输入框；标签类（用户身份标签）用逐条添加的小牌编辑器。
     未绑定用户身份时，「用户称」与「用户身份标签」两项禁止编辑
     （无落点可写），点击后提示先完成绑定，而不是静默失败。 ---- */
  function initBondEditor(els, bond) {
    if (!els.bondEditor || els.bondEditor._bound) return;
    els.bondEditor._bound = true;

    var FIELD_META = {
      charCall: {
        title: '编辑「角色 称」', hint: '角色将以此称呼你，写入角色档案',
        kind: 'text', target: 'char', prop: 'callUser'
      },
      userCall: {
        title: '编辑「用户 称」', hint: '你对角色的称呼，写入当前绑定的用户身份卡',
        kind: 'text', target: 'user', prop: 'callChar'
      },
      context: {
        title: '编辑「相识情境」', hint: '简述你们如何相识、目前处于什么阶段，写入角色档案',
        kind: 'text', target: 'char', prop: 'meetContext'
      },
      tags: {
        title: '编辑「用户身份标签」', hint: '为当前身份添加标签，写入用户身份卡',
        kind: 'tags', target: 'user', prop: 'tags'
      }
    };

    var current = null; // 当前正在编辑的 field key
    var draftTags = [];

    function currentTargetRecord(meta) {
      return meta.target === 'char' ? bond.charRecord : bond.userIdentity;
    }

    function renderChips() {
      els.bondEditorChips.innerHTML = '';
      draftTags.forEach(function (t, idx) {
        var chip = document.createElement('span');
        chip.className = 'cst-bond-editor-chip';
        chip.innerHTML = '<span></span><button type="button" class="cst-bond-editor-chip-remove" aria-label="移除"><svg viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>';
        chip.querySelector('span').textContent = t;
        chip.querySelector('button').addEventListener('click', function () {
          draftTags.splice(idx, 1);
          renderChips();
        });
        els.bondEditorChips.appendChild(chip);
      });
    }

    function openEditor(field) {
      var meta = FIELD_META[field];
      if (!meta) return;

      if (meta.target === 'user' && !bond.userIdentity) {
        showBondPickerNote(els, '请先在下方缔结用户身份，再编辑此项');
        return;
      }
      if (meta.target === 'char' && !bond.charRecord) {
        showBondPickerNote(els, '未找到角色档案，暂无法编辑');
        return;
      }

      current = field;
      els.bondEditorTitle.textContent = meta.title;
      els.bondEditorHint.textContent = meta.hint;
      els.bondSeal.setAttribute('data-bond-edit-kind', meta.kind);

      var record = currentTargetRecord(meta);
      if (meta.kind === 'tags') {
        var raw = (record && Array.isArray(record[meta.prop])) ? record[meta.prop] : [];
        draftTags = raw.map(function (t) { return (t && t.text) ? t.text : t; }).filter(Boolean);
        renderChips();
        els.bondEditorTagInput.value = '';
      } else {
        els.bondEditorInput.value = (record && record[meta.prop]) || '';
      }

      /* ---- aria-hidden 与实际可见/可聚焦状态严格同步：编辑面板整体、
         以及文本/标签两个子面板，谁在展示就把谁的 aria-hidden 去掉，
         避免「容器已标记为对屏幕阅读器隐藏，但内部控件仍可聚焦」的
         无障碍冲突（浏览器会对此发出警告） ---- */
      els.bondSeal.classList.add('is-editing');
      els.bondEditor.setAttribute('aria-hidden', 'false');
      if (els.bondEditorTagsWrap) {
        els.bondEditorTagsWrap.setAttribute('aria-hidden', meta.kind === 'tags' ? 'false' : 'true');
      }
      if (meta.kind === 'text') {
        setTimeout(function () { els.bondEditorInput.focus(); }, 50);
      } else {
        setTimeout(function () { els.bondEditorTagInput.focus(); }, 50);
      }
    }

    function closeEditor() {
      var previousField = current;
      current = null;
      /* ---- 先把焦点移出即将被 aria-hidden 的容器，再隐藏它——
         顺序不能反：如果先隐藏容器，焦点仍停留在容器内部的按钮/输入框上，
         就会触发「aria-hidden 祖先内含被聚焦元素」的无障碍冲突 ---- */
      if (document.activeElement && els.bondEditor.contains(document.activeElement)) {
        document.activeElement.blur();
      }
      els.bondSeal.classList.remove('is-editing');
      els.bondEditor.setAttribute('aria-hidden', 'true');
      if (els.bondEditorTagsWrap) els.bondEditorTagsWrap.setAttribute('aria-hidden', 'true');
      els.bondSeal.removeAttribute('data-bond-edit-kind');
      if (previousField) {
        // 焦点回落到触发编辑的那一行，保持键盘/屏幕阅读器操作连贯
        var triggerId = 'cstBondEdit' + previousField.charAt(0).toUpperCase() + previousField.slice(1);
        var trigger = document.getElementById(triggerId);
        if (trigger) { try { trigger.focus({ preventScroll: true }); } catch (e) {} }
      }
    }

    function saveEditor() {
      var meta = FIELD_META[current];
      if (!meta) return;
      var record = currentTargetRecord(meta);
      if (!record) { closeEditor(); return; }

      els.bondEditorSave.setAttribute('disabled', 'disabled');

      var value = meta.kind === 'tags' ? draftTags.slice() : els.bondEditorInput.value.trim();
      var writer = meta.target === 'char'
        ? updateBondCharField(record, meta.prop, value)
        : updateBondIdentityField(record, meta.prop, value);

      writer.then(function (updated) {
        els.bondEditorSave.removeAttribute('disabled');
        if (!updated) {
          showBondPickerNote(els, '保存失败，请重试');
          return;
        }
        if (meta.target === 'char') { bond.charRecord = updated; }
        else { bond.userIdentity = updated; }

        renderBondFacts(els, bond.charRecord, bond.userIdentity);
        renderBondOrient(els, bond.charRecord, bond.userIdentity, bond.session);
        notifyIdentityUpdate();
        closeEditor();
      });
    }

    els.bondEditCharCall.addEventListener('click', function () { openEditor('charCall'); });
    els.bondEditUserCall.addEventListener('click', function () { openEditor('userCall'); });
    els.bondEditContext.addEventListener('click', function () { openEditor('context'); });
    els.bondEditTags.addEventListener('click', function () { openEditor('tags'); });

    els.bondEditorClose.addEventListener('click', closeEditor);
    els.bondEditorCancel.addEventListener('click', closeEditor);
    els.bondEditorSave.addEventListener('click', saveEditor);

    els.bondEditorChipAdd.addEventListener('click', function () {
      var v = els.bondEditorTagInput.value.trim();
      if (!v) return;
      if (draftTags.indexOf(v) === -1) draftTags.push(v);
      els.bondEditorTagInput.value = '';
      renderChips();
      els.bondEditorTagInput.focus();
    });
    els.bondEditorTagInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); els.bondEditorChipAdd.click(); }
    });
    els.bondEditorInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); saveEditor(); }
    });
  }

  function initBondSeal(els, session) {
    /* ---- 共享态：char/user 当前记录与是否已绑定，供编辑面板保存后
       就地刷新展示，无需重新整页拉取 ---- */
    var bond = { charRecord: null, userIdentity: null, session: session };

    Promise.all([getAllBondChars(), getAllBondIdentities()]).then(function (res) {
      var chars = res[0] || [];
      var identities = res[1] || [];
      var charRecord = findBondCharRecord(chars, session);
      var charId = charRecord ? charRecord.id : null;
      var userIdentity = findBondUserIdentity(identities, charId);

      bond.charRecord = charRecord;
      bond.userIdentity = userIdentity;

      renderCharPlate(els, charRecord, session);
      renderBondFacts(els, charRecord, userIdentity);
      renderBondOrient(els, charRecord, userIdentity, session);
      initBondEditor(els, bond);

      if (userIdentity) {
        els.bondSeal.classList.remove('is-picking', 'is-empty-vault');
        renderUserPlate(els, userIdentity);
        return;
      }

      /* ---- 未绑定：用户侧先展示「待缔结」占位，不冒充任何身份 ---- */
      els.bondUserName.textContent = '待缔结';
      els.bondUserRole.textContent = '';
      els.bondUserAvatar.innerHTML = '<span class="cst-bond-avatar-glyph">？</span>';
      els.bondUserAvatar.style.background = '';

      var activeIdentities = identities.filter(function (i) { return i.active !== false; });

      if (!activeIdentities.length) {
        els.bondSeal.classList.remove('is-picking');
        els.bondSeal.classList.add('is-empty-vault');
        if (!els.bondEmptyBtn._bound) {
          els.bondEmptyBtn._bound = true;
          els.bondEmptyBtn.addEventListener('click', function () { goCreateIdentity(session); });
        }
        return;
      }

      els.bondSeal.classList.remove('is-empty-vault');
      els.bondSeal.classList.add('is-picking');
      els.bondPickerTitle.textContent = charRecord
        ? ('「' + (charRecord.name || session.name) + '」尚未与任何用户身份缔结羁绊')
        : '尚未与任何用户身份缔结羁绊';

      activeIdentities.sort(function (a, b) {
        if (!!a.isPrimary !== !!b.isPrimary) return a.isPrimary ? -1 : 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });

      els.bondPickerList.innerHTML = '';
      activeIdentities.forEach(function (identity) {
        var row = buildPickerRow(identity, function (picked, restore) {
          if (charId == null) {
            restore();
            showBondPickerNote(els, '此角色暂无有效档案，无法建立绑定');
            return;
          }
          bindIdentityToChar(picked, charId).then(function (updated) {
            if (!updated) {
              restore();
              showBondPickerNote(els, '绑定失败，请重试');
              return;
            }
            els.bondSeal.classList.remove('is-picking');
            bond.userIdentity = updated;
            renderUserPlate(els, updated);
            renderBondFacts(els, charRecord, updated);
            renderBondOrient(els, charRecord, updated, session);
            notifyIdentityUpdate();
          });
        });
        els.bondPickerList.appendChild(row);
      });

      if (!els.bondPickerNew._bound) {
        els.bondPickerNew._bound = true;
        els.bondPickerNew.addEventListener('click', function () { goCreateIdentity(session); });
      }
    }).catch(function () {
      els.bondSeal.classList.add('is-empty-vault');
      if (!els.bondEmptyBtn._bound) {
        els.bondEmptyBtn._bound = true;
        els.bondEmptyBtn.addEventListener('click', function () { goCreateIdentity(session); });
      }
    });
  }

  function showBondPickerNote(els, text) {
    if (!els.bondPickerTitle) return;
    var old = els.bondPickerTitle.textContent;
    els.bondPickerTitle.textContent = text;
    setTimeout(function () { els.bondPickerTitle.textContent = old; }, 2200);
  }

  /* ---- 通知其它页面（user.html 若在其它标签页打开）身份数据已变化，
     沿用 characters.js / user.js 已有的同一套 localStorage 广播键 ---- */
  function notifyIdentityUpdate() {
    try { localStorage.setItem('luna_char_db_update', Date.now()); } catch (e) {}
  }

  /* ---- 前往创建身份：user.html 的返回按钮只认识
     luna_return_to = chat_profile（回好友列表）/ wallet_me 两种去向，
     没有「回到本聊天室设置页」的选项。这里如实告知即将离开，
     并复用 chat_profile 让对方至少能从好友列表快速找回这个聊天室，
     而不是无提示地跳转到一个不认得回路的页面。 ---- */
  function goCreateIdentity(session) {
    try { localStorage.setItem('luna_return_to', 'chat_profile'); } catch (e) {}
    window.location.href = '../user.html';
  }
})();