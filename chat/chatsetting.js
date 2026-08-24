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
})();
