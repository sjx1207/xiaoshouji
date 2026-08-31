/* ==========================================================================
   emoji-vault.js
   独立表情包页面 —— 完整功能实现，不依赖任何宿主聊天应用脚本

   数据落盘：本文件内置一个轻量 IndexedDB KV 封装（与旧版共用同一个
   数据库名 luna_chat_db / kv 表，因此原有表情数据不会丢失），存储键：
     'stickers:list'    -> 表情数组 [{ id, src, text, groupId, createdAt }]
     'stickers:groups'  -> 自定义分组数组 [{ id, name, createdAt }]
========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     极简 IndexedDB KV 封装（本页专属，不挂到 window，不依赖外部脚本）
  ------------------------------------------------------------------ */
  var Store = (function () {
    var DB_NAME = 'luna_chat_db';
    var DB_VERSION = 1;
    var TABLE = 'kv';
    var openPromise = null;

    function openDb() {
      if (openPromise) return openPromise;
      openPromise = new Promise(function (resolve, reject) {
        if (!window.indexedDB) { reject(new Error('no-indexeddb')); return; }
        var req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains(TABLE)) {
            db.createObjectStore(TABLE, { keyPath: 'key' });
          }
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
      return openPromise;
    }

    function read(key) {
      return openDb().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(TABLE, 'readonly');
          var req = tx.objectStore(TABLE).get(key);
          req.onsuccess = function () { resolve(req.result ? req.result.value : undefined); };
          req.onerror = function () { reject(req.error); };
        });
      }).catch(function () { return undefined; });
    }

    function write(key, value) {
      return openDb().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(TABLE, 'readwrite');
          var req = tx.objectStore(TABLE).put({ key: key, value: value });
          req.onsuccess = function () { resolve(true); };
          req.onerror = function () { reject(req.error); };
        });
      }).catch(function () { return false; });
    }

    return { read: read, write: write };
  })();

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(function () {

    /* ==========================================================================
       状态栏时间 / 电量
    ========================================================================== */
    function paintStatusline() {
      var tz = 'Asia/Shanghai';
      try { tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai'; } catch (e) {}
      var now = new Date();
      var clockEl = document.getElementById('evClock');
      if (clockEl) {
        clockEl.textContent = now.toLocaleTimeString('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
      }
      var pct = 76;
      try {
        var saved = localStorage.getItem('luna_battery');
        if (saved !== null && !isNaN(parseInt(saved, 10))) {
          pct = Math.max(1, Math.min(100, parseInt(saved, 10)));
        }
      } catch (e) {}
      var numEl = document.getElementById('evBattNum');
      var fillEl = document.getElementById('evBattFill');
      if (numEl) numEl.textContent = pct;
      if (fillEl) fillEl.style.width = pct + '%';
    }
    paintStatusline();
    setInterval(paintStatusline, 30000);

    /* ==========================================================================
       数据访问
    ========================================================================== */
    function newId() {
      return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    }
    function loadStickers() {
      return Store.read('stickers:list').then(function (v) { return Array.isArray(v) ? v : []; });
    }
    function saveStickers(list) {
      return Store.write('stickers:list', list);
    }
    function loadGroups() {
      return Store.read('stickers:groups').then(function (v) { return Array.isArray(v) ? v : []; });
    }
    function saveGroups(list) {
      return Store.write('stickers:groups', list);
    }

    function escapeHtml(str) {
      return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
    function hashText(str) {
      var h = 0;
      for (var i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; }
      return h;
    }
    function stripExtension(filename) {
      return String(filename || '').replace(/\.[a-zA-Z0-9]+$/, '');
    }
    function formatBytes(bytes) {
      if (bytes < 1024) return bytes + 'B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
      return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
    }

    /* ==========================================================================
       Toast
    ========================================================================== */
    var toastEl = document.getElementById('evToast');
    var toastTimer = null;
    function flashToast(msg) {
      if (!toastEl) return;
      toastEl.textContent = msg;
      toastEl.classList.add('is-live');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toastEl.classList.remove('is-live'); }, 1800);
    }

    /* ==========================================================================
       返回导航（独立页面：直接返回上一页/关闭）
    ========================================================================== */
    var backBtn = document.getElementById('evNavBack');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.close();
        }
      });
    }

    /* ==========================================================================
       弹窗通用开关（原生 <dialog>）
    ========================================================================== */
    function wireDialog(dialogId, closeBtnId, onReset) {
      var dlg = document.getElementById(dialogId);
      var closeBtn = closeBtnId ? document.getElementById(closeBtnId) : null;
      if (!dlg) return { open: function () {}, close: function () {} };

      var hideTimer = null;

      function close() {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        dlg.classList.remove('is-live');
        hideTimer = setTimeout(function () {
          hideTimer = null;
          if (dlg.open) dlg.close();
        }, 300);
      }
      function open() {
        if (onReset) onReset();
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        if (!dlg.open) dlg.showModal();
        requestAnimationFrame(function () { dlg.classList.add('is-live'); });
      }

      dlg.addEventListener('click', function (e) {
        if (e.target === dlg) close();
      });
      if (closeBtn) closeBtn.addEventListener('click', close);
      dlg.addEventListener('cancel', function (e) {
        e.preventDefault();
        close();
      });
      return { open: open, close: close };
    }

    /* ==========================================================================
       分组渲染：横滑标签条 + 三个弹窗内的分组胶囊 + 分组管理列表
    ========================================================================== */
    var tagRail = document.getElementById('evTagRail');
    var singleTagPicker = document.getElementById('evSingleTagPicker');
    var batchTagPicker = document.getElementById('evBatchTagPicker');
    var editTagPicker = document.getElementById('evEditTagPicker');
    var tagManagerList = document.getElementById('evTagManagerList');

    var activeFilter = '__all__';
    var singlePickedTag = null;
    var batchPickedTag = null;
    var editPickedTag = null;

    function tagGlyphSvg() {
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="4.4" y="4.4" width="7.4" height="7.4" rx="2" stroke="currentColor" stroke-width="1.3"/><circle cx="16.4" cy="8.1" r="3.3" stroke="currentColor" stroke-width="1.3"/><path d="M5.4 19.4L9.2 14.3L12.2 17.4L15 13.5L18.6 18.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }

    function paintTagRail(groups, stickers) {
      if (!tagRail) return;
      var frag = document.createDocumentFragment();

      var allBtn = document.createElement('button');
      allBtn.type = 'button';
      allBtn.className = 'ev-tag-chip' + (activeFilter === '__all__' ? ' is-current' : '');
      allBtn.dataset.tag = '__all__';
      allBtn.innerHTML = '<span>全部</span><span class="ev-tag-num">' + stickers.length + '</span>';
      allBtn.addEventListener('click', function () { pickFilter('__all__'); });
      frag.appendChild(allBtn);

      groups.forEach(function (g) {
        var count = stickers.filter(function (s) { return s.groupId === g.id; }).length;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ev-tag-chip' + (activeFilter === g.id ? ' is-current' : '');
        btn.dataset.tag = g.id;
        btn.innerHTML = '<span>' + escapeHtml(g.name) + '</span><span class="ev-tag-num">' + count + '</span>';
        btn.addEventListener('click', function () { pickFilter(g.id); });
        frag.appendChild(btn);
      });

      var plusBtn = document.createElement('button');
      plusBtn.type = 'button';
      plusBtn.className = 'ev-tag-plus';
      plusBtn.setAttribute('aria-label', '新建分组');
      plusBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
      plusBtn.addEventListener('click', openTagManager);
      frag.appendChild(plusBtn);

      tagRail.innerHTML = '';
      tagRail.appendChild(frag);
    }

    function paintTagPicker(container, groups, selected, onPick) {
      if (!container) return;
      var frag = document.createDocumentFragment();

      var noneBtn = document.createElement('button');
      noneBtn.type = 'button';
      noneBtn.className = 'ev-tag-picker-chip' + (selected === null ? ' is-current' : '');
      noneBtn.textContent = '不归档';
      noneBtn.addEventListener('click', function () { onPick(null); });
      frag.appendChild(noneBtn);

      groups.forEach(function (g) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ev-tag-picker-chip' + (selected === g.id ? ' is-current' : '');
        btn.textContent = g.name;
        btn.addEventListener('click', function () { onPick(g.id); });
        frag.appendChild(btn);
      });

      container.innerHTML = '';
      container.appendChild(frag);
    }

    function paintTagManagerList(groups, stickers) {
      if (!tagManagerList) return;
      if (!groups.length) {
        tagManagerList.innerHTML = '<div class="ev-tag-manager-empty">还没有自定义分组，创建一个开始归档你的表情包吧</div>';
        return;
      }
      var frag = document.createDocumentFragment();
      groups.forEach(function (g) {
        var count = stickers.filter(function (s) { return s.groupId === g.id; }).length;
        var row = document.createElement('div');
        row.className = 'ev-tag-manager-row';

        var glyph = document.createElement('div');
        glyph.className = 'ev-tag-manager-glyph';
        glyph.innerHTML = tagGlyphSvg();
        row.appendChild(glyph);

        var name = document.createElement('div');
        name.className = 'ev-tag-manager-name';
        name.textContent = g.name;
        name.setAttribute('contenteditable', 'true');
        name.addEventListener('blur', function () {
          var val = name.textContent.trim().slice(0, 12) || g.name;
          name.textContent = val;
          if (val !== g.name) {
            g.name = val;
            loadGroups().then(function (list) {
              var next = list.map(function (it) { return it.id === g.id ? g : it; });
              saveGroups(next).then(function () { refreshEverything(); });
            });
          }
        });
        row.appendChild(name);

        var countEl = document.createElement('span');
        countEl.className = 'ev-tag-manager-count';
        countEl.textContent = count + ' 个';
        row.appendChild(countEl);

        var delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'ev-tag-manager-del';
        delBtn.setAttribute('aria-label', '删除分组');
        delBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 5L19 19M19 5L5 19" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
        delBtn.addEventListener('click', function () {
          Promise.all([loadGroups(), loadStickers()]).then(function (res) {
            var groupsList = res[0], stickersList = res[1];
            var nextGroups = groupsList.filter(function (it) { return it.id !== g.id; });
            var nextStickers = stickersList.map(function (s) {
              if (s.groupId === g.id) s.groupId = null;
              return s;
            });
            if (activeFilter === g.id) activeFilter = '__all__';
            Promise.all([saveGroups(nextGroups), saveStickers(nextStickers)]).then(function () {
              flashToast('已删除分组');
              refreshEverything();
            });
          });
        });
        row.appendChild(delBtn);

        frag.appendChild(row);
      });
      tagManagerList.innerHTML = '';
      tagManagerList.appendChild(frag);
    }

    function pickFilter(id) {
      activeFilter = id;
      refreshEverything();
    }

    /* ==========================================================================
       网格渲染
    ========================================================================== */
    var wallEl = document.getElementById('evWall');
    var blankEl = document.getElementById('evBlank');
    var visibleCountEl = document.getElementById('evVisibleCount');

    function buildTile(sticker, groupsById) {
      var tile = document.createElement('div');
      tile.className = 'ev-tile';
      tile.dataset.id = sticker.id;

      var media = document.createElement('div');
      media.className = 'ev-tile-media';
      if (sticker.src) {
        var img = document.createElement('img');
        img.src = sticker.src;
        img.alt = sticker.text || '';
        img.loading = 'lazy';
        img.onerror = function () {
          media.innerHTML = '<div class="ev-tile-media-fallback"><svg width="26" height="26" viewBox="0 0 24 24" fill="none"><rect x="4.4" y="4.4" width="15.2" height="15.2" rx="3" stroke="currentColor" stroke-width="1.3"/><path d="M8 14.5L11 10.8L13.4 13.4L15.6 10.6L18 14" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>';
        };
        media.appendChild(img);
      }
      var ratio = 0.82 + (hashText(sticker.id) % 5) * 0.09;
      media.style.aspectRatio = '1 / ' + ratio.toFixed(2);
      tile.appendChild(media);

      var corner = document.createElement('span');
      corner.className = 'ev-tile-corner';
      corner.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 12H19M13 6L19 12L13 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      tile.appendChild(corner);

      var foot = document.createElement('div');
      foot.className = 'ev-tile-foot';
      var textEl = document.createElement('div');
      textEl.className = 'ev-tile-text';
      textEl.textContent = sticker.text || '';
      foot.appendChild(textEl);
      if (sticker.groupId && groupsById[sticker.groupId]) {
        var tagEl = document.createElement('div');
        tagEl.className = 'ev-tile-tag';
        tagEl.textContent = groupsById[sticker.groupId].name;
        foot.appendChild(tagEl);
      }
      tile.appendChild(foot);

      tile.addEventListener('click', function () { openEditor(sticker.id); });
      return tile;
    }

    function paintWall(stickers, groups) {
      if (!wallEl) return;
      var groupsById = {};
      groups.forEach(function (g) { groupsById[g.id] = g; });

      var visible = activeFilter === '__all__'
        ? stickers
        : stickers.filter(function (s) { return s.groupId === activeFilter; });

      if (visibleCountEl) visibleCountEl.textContent = visible.length + ' 个';

      if (!visible.length) {
        wallEl.style.display = 'none';
        if (blankEl) blankEl.style.display = 'flex';
        wallEl.innerHTML = '';
        return;
      }
      if (blankEl) blankEl.style.display = 'none';
      wallEl.style.display = 'block';

      var frag = document.createDocumentFragment();
      visible.slice().reverse().forEach(function (s) { frag.appendChild(buildTile(s, groupsById)); });
      wallEl.innerHTML = '';
      wallEl.appendChild(frag);
    }

    function refreshEverything() {
      return Promise.all([loadStickers(), loadGroups()]).then(function (res) {
        var stickers = res[0], groups = res[1];
        paintTagRail(groups, stickers);
        paintWall(stickers, groups);
        return { stickers: stickers, groups: groups };
      });
    }

    function refreshSinglePicker() {
      loadGroups().then(function (groups) {
        paintTagPicker(singleTagPicker, groups, singlePickedTag, function (id) {
          singlePickedTag = id;
          refreshSinglePicker();
        });
      });
    }
    function refreshBatchPicker() {
      loadGroups().then(function (groups) {
        paintTagPicker(batchTagPicker, groups, batchPickedTag, function (id) {
          batchPickedTag = id;
          refreshBatchPicker();
        });
      });
    }
    function refreshEditPicker() {
      loadGroups().then(function (groups) {
        paintTagPicker(editTagPicker, groups, editPickedTag, function (id) {
          editPickedTag = id;
          refreshEditPicker();
        });
      });
    }

    /* ==========================================================================
       单张 / URL 导入弹窗
    ========================================================================== */
    var pendingSrc = null;
    var currentSourceMode = 'file';

    var singleDialog = wireDialog('evSingleDialog', 'evSingleClose', function () {
      pendingSrc = null;
      currentSourceMode = 'file';
      singlePickedTag = null;
      document.getElementById('evTextField').value = '';
      document.getElementById('evUrlField').value = '';
      var statusEl = document.getElementById('evUrlStatus');
      if (statusEl) { statusEl.textContent = ''; statusEl.className = 'ev-url-status'; }
      resetLocalDrop();
      resetUrlPreview();
      switchSourceMode('file');
      refreshSinglePicker();
      updateSingleSubmitState();
    });

    var openSingleBtn = document.getElementById('evOpenSingle');
    if (openSingleBtn) openSingleBtn.addEventListener('click', singleDialog.open);

    var switchBtns = document.querySelectorAll('#evSingleDialog .ev-switch-btn');
    function switchSourceMode(mode) {
      currentSourceMode = mode;
      switchBtns.forEach(function (btn) {
        btn.classList.toggle('is-current', btn.dataset.src === mode);
      });
      document.querySelectorAll('#evSingleDialog .ev-src-pane').forEach(function (pane) {
        pane.style.display = pane.dataset.pane === mode ? 'block' : 'none';
      });
      updateSingleSubmitState();
    }
    switchBtns.forEach(function (btn) {
      btn.addEventListener('click', function () { switchSourceMode(btn.dataset.src); });
    });

    var localDrop = document.getElementById('evLocalDrop');
    var localDropHint = document.getElementById('evLocalDropHint');
    var localDropRemove = document.getElementById('evLocalDropRemove');
    var localFileInput = document.getElementById('evLocalFileInput');

    function resetLocalDrop() {
      if (!localDrop) return;
      localDrop.classList.remove('has-media');
      var existingImg = localDrop.querySelector('img');
      if (existingImg) existingImg.remove();
      if (localDropHint) localDropHint.style.display = 'flex';
      if (localDropRemove) localDropRemove.style.display = 'none';
      if (localFileInput) localFileInput.value = '';
    }

    if (localDrop) {
      localDrop.addEventListener('click', function (e) {
        if (e.target === localDropRemove || (localDropRemove && localDropRemove.contains(e.target))) return;
        if (localFileInput) localFileInput.click();
      });
      localDrop.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (localFileInput) localFileInput.click();
        }
      });
    }
    if (localDropRemove) {
      localDropRemove.addEventListener('click', function (e) {
        e.stopPropagation();
        pendingSrc = null;
        resetLocalDrop();
        updateSingleSubmitState();
      });
    }
    if (localFileInput) {
      localFileInput.addEventListener('change', function () {
        var file = localFileInput.files && localFileInput.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          pendingSrc = reader.result;
          localDrop.classList.add('has-media');
          if (localDropHint) localDropHint.style.display = 'none';
          var img = document.createElement('img');
          img.src = pendingSrc;
          img.alt = '';
          localDrop.insertBefore(img, localDrop.firstChild);
          if (localDropRemove) localDropRemove.style.display = 'flex';
          updateSingleSubmitState();
        };
        reader.readAsDataURL(file);
      });
    }

    var urlField = document.getElementById('evUrlField');
    var urlGoBtn = document.getElementById('evUrlGo');
    var urlStatusEl = document.getElementById('evUrlStatus');
    var urlPreviewZone = document.getElementById('evUrlDrop');
    var urlPreviewHint = document.getElementById('evUrlDropHint');
    var urlPreviewRemove = document.getElementById('evUrlDropRemove');

    function resetUrlPreview() {
      if (!urlPreviewZone) return;
      urlPreviewZone.classList.remove('has-media');
      var existingImg = urlPreviewZone.querySelector('img');
      if (existingImg) existingImg.remove();
      if (urlPreviewHint) urlPreviewHint.style.display = 'flex';
      if (urlPreviewRemove) urlPreviewRemove.style.display = 'none';
    }

    function probeImage(url) {
      return new Promise(function (resolve, reject) {
        var img = new Image();
        var settled = false;
        var timer = setTimeout(function () {
          if (settled) return;
          settled = true;
          reject(new Error('timeout'));
        }, 8000);
        img.onload = function () {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(url);
        };
        img.onerror = function () {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(new Error('load-error'));
        };
        img.referrerPolicy = 'no-referrer';
        img.src = url;
      });
    }

    function runUrlParse() {
      var url = urlField ? urlField.value.trim() : '';
      if (!url) return;
      if (urlStatusEl) { urlStatusEl.textContent = '正在解析…'; urlStatusEl.className = 'ev-url-status'; }
      probeImage(url).then(function (okUrl) {
        pendingSrc = okUrl;
        urlPreviewZone.classList.add('has-media');
        if (urlPreviewHint) urlPreviewHint.style.display = 'none';
        var img = document.createElement('img');
        img.src = okUrl;
        img.alt = '';
        urlPreviewZone.insertBefore(img, urlPreviewZone.firstChild);
        if (urlPreviewRemove) urlPreviewRemove.style.display = 'flex';
        if (urlStatusEl) { urlStatusEl.textContent = '解析成功，可直接保存'; urlStatusEl.className = 'ev-url-status is-good'; }
        updateSingleSubmitState();
      }).catch(function () {
        pendingSrc = null;
        if (urlStatusEl) { urlStatusEl.textContent = '解析失败，请检查链接是否为可访问的图片地址'; urlStatusEl.className = 'ev-url-status is-bad'; }
        updateSingleSubmitState();
      });
    }
    if (urlGoBtn) urlGoBtn.addEventListener('click', runUrlParse);
    if (urlField) {
      urlField.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') runUrlParse();
      });
    }
    if (urlPreviewRemove) {
      urlPreviewRemove.addEventListener('click', function (e) {
        e.stopPropagation();
        pendingSrc = null;
        resetUrlPreview();
        if (urlStatusEl) { urlStatusEl.textContent = ''; urlStatusEl.className = 'ev-url-status'; }
        updateSingleSubmitState();
      });
    }

    var singleSubmitBtn = document.getElementById('evSingleSubmit');
    function updateSingleSubmitState() {
      if (!singleSubmitBtn) return;
      singleSubmitBtn.classList.toggle('is-armed', !!pendingSrc);
    }
    if (singleSubmitBtn) {
      singleSubmitBtn.addEventListener('click', function () {
        if (!pendingSrc) return;
        var textVal = document.getElementById('evTextField').value.trim();
        var sticker = {
          id: newId(),
          src: pendingSrc,
          text: textVal,
          groupId: singlePickedTag,
          createdAt: Date.now()
        };
        loadStickers().then(function (list) {
          list.push(sticker);
          return saveStickers(list);
        }).then(function () {
          flashToast('已保存到表情包');
          singleDialog.close();
          refreshEverything();
        });
      });
    }

    /* ==========================================================================
       批量导入弹窗
    ========================================================================== */
    var pendingFiles = [];
    var pendingTextEntries = [];

    var batchDialog = wireDialog('evBatchDialog', 'evBatchClose', function () {
      pendingFiles = [];
      pendingTextEntries = [];
      batchPickedTag = null;
      document.getElementById('evBatchTextarea').value = '';
      document.getElementById('evBatchFileInput').value = '';
      paintBatchFileList();
      paintBatchPreview();
      refreshBatchPicker();
      updateBatchSubmitState();
    });

    var openBatchBtn = document.getElementById('evOpenBatch');
    if (openBatchBtn) openBatchBtn.addEventListener('click', batchDialog.open);

    var batchDropBtn = document.getElementById('evBatchDropBtn');
    var batchFileInput = document.getElementById('evBatchFileInput');
    var batchFileListEl = document.getElementById('evBatchFiles');

    if (batchDropBtn) batchDropBtn.addEventListener('click', function () { if (batchFileInput) batchFileInput.click(); });

    if (batchFileInput) {
      batchFileInput.addEventListener('change', function () {
        var files = Array.prototype.slice.call(batchFileInput.files || []);
        if (!files.length) return;
        var readTasks = files.map(function (file) {
          return new Promise(function (resolve) {
            var reader = new FileReader();
            reader.onload = function () {
              resolve({ id: newId(), name: file.name, size: file.size, src: reader.result });
            };
            reader.onerror = function () { resolve(null); };
            reader.readAsDataURL(file);
          });
        });
        Promise.all(readTasks).then(function (results) {
          results.forEach(function (r) { if (r) pendingFiles.push(r); });
          paintBatchFileList();
          updateBatchSubmitState();
        });
      });
    }

    function paintBatchFileList() {
      if (!batchFileListEl) return;
      if (!pendingFiles.length) {
        batchFileListEl.style.display = 'none';
        batchFileListEl.innerHTML = '';
        return;
      }
      batchFileListEl.style.display = 'flex';
      var frag = document.createDocumentFragment();
      pendingFiles.forEach(function (f) {
        var row = document.createElement('div');
        row.className = 'ev-batch-file-row';
        var nameEl = document.createElement('span');
        nameEl.className = 'ev-bf-name';
        nameEl.textContent = f.name;
        var sizeEl = document.createElement('span');
        sizeEl.className = 'ev-bf-size';
        sizeEl.textContent = formatBytes(f.size);
        row.appendChild(nameEl);
        row.appendChild(sizeEl);
        frag.appendChild(row);
      });
      batchFileListEl.innerHTML = '';
      batchFileListEl.appendChild(frag);
    }

    var batchTextarea = document.getElementById('evBatchTextarea');
    var batchPreviewHead = document.getElementById('evBatchPreviewHead');
    var batchPreviewNum = document.getElementById('evBatchPreviewNum');
    var batchPreviewList = document.getElementById('evBatchPreviewList');
    var batchPreviewClear = document.getElementById('evBatchPreviewClear');

    function parseTextLines(raw) {
      var lines = raw.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
      var out = [];
      lines.forEach(function (line) {
        var m = line.match(/^(.*?)[：:]\s*(https?:\/\/\S+)$/i);
        if (!m) {
          m = line.match(/^(.*?)\s+(https?:\/\/\S+)$/i);
        }
        if (!m) {
          var bare = line.match(/^(https?:\/\/\S+)$/i);
          if (bare) { out.push({ name: '', url: bare[1] }); }
          return;
        }
        var name = m[1].trim();
        var url = m[2].trim();
        if (url) out.push({ name: name, url: url });
      });
      return out;
    }

    function paintBatchPreview() {
      if (!batchPreviewList) return;
      var total = pendingTextEntries.length;
      if (batchPreviewHead) batchPreviewHead.style.display = total ? 'flex' : 'none';
      if (batchPreviewNum) batchPreviewNum.textContent = String(total);

      if (!total) { batchPreviewList.innerHTML = ''; return; }

      var frag = document.createDocumentFragment();
      pendingTextEntries.forEach(function (item) {
        var row = document.createElement('div');
        row.className = 'ev-batch-preview-row';
        row.dataset.id = item.id;

        var thumb = document.createElement('div');
        thumb.className = 'ev-bpr-thumb';
        if (item.status === 'ok') {
          var img = document.createElement('img');
          img.src = item.url;
          img.alt = '';
          thumb.appendChild(img);
        } else {
          thumb.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="4.4" y="4.4" width="15.2" height="15.2" rx="3" stroke="currentColor" stroke-width="1.3"/></svg>';
        }
        row.appendChild(thumb);

        var col = document.createElement('div');
        col.className = 'ev-bpr-col';
        var nameEl = document.createElement('div');
        nameEl.className = 'ev-bpr-name';
        nameEl.textContent = item.name || '（未命名）';
        var srcEl = document.createElement('div');
        srcEl.className = 'ev-bpr-src';
        srcEl.textContent = item.url;
        col.appendChild(nameEl);
        col.appendChild(srcEl);
        row.appendChild(col);

        var dot = document.createElement('span');
        dot.className = 'ev-bpr-dot' + (item.status === 'ok' ? ' is-good' : item.status === 'err' ? ' is-bad' : '');
        row.appendChild(dot);

        frag.appendChild(row);
      });
      batchPreviewList.innerHTML = '';
      batchPreviewList.appendChild(frag);
    }

    var batchParseDebounce = null;
    if (batchTextarea) {
      batchTextarea.addEventListener('input', function () {
        if (batchParseDebounce) clearTimeout(batchParseDebounce);
        batchParseDebounce = setTimeout(runBatchParse, 320);
      });
    }

    function runBatchParse() {
      var raw = batchTextarea ? batchTextarea.value : '';
      var entries = parseTextLines(raw);
      var prevByUrl = {};
      pendingTextEntries.forEach(function (it) { prevByUrl[it.url] = it; });

      pendingTextEntries = entries.map(function (e) {
        var prev = prevByUrl[e.url];
        return prev ? { id: prev.id, name: e.name || prev.name, url: e.url, status: prev.status } : { id: newId(), name: e.name, url: e.url, status: 'pending' };
      });
      paintBatchPreview();
      updateBatchSubmitState();

      pendingTextEntries.filter(function (it) { return it.status === 'pending'; }).forEach(function (it) {
        probeImage(it.url).then(function () {
          it.status = 'ok';
          paintBatchPreview();
          updateBatchSubmitState();
        }).catch(function () {
          it.status = 'err';
          paintBatchPreview();
          updateBatchSubmitState();
        });
      });
    }

    if (batchPreviewClear) {
      batchPreviewClear.addEventListener('click', function () {
        pendingTextEntries = [];
        if (batchTextarea) batchTextarea.value = '';
        paintBatchPreview();
        updateBatchSubmitState();
      });
    }

    var batchSubmitBtn = document.getElementById('evBatchSubmit');
    var batchSubmitLabel = document.getElementById('evBatchSubmitText');
    function updateBatchSubmitState() {
      if (!batchSubmitBtn) return;
      var okTextCount = pendingTextEntries.filter(function (it) { return it.status !== 'err'; }).length;
      var total = pendingFiles.length + okTextCount;
      batchSubmitBtn.classList.toggle('is-armed', total > 0);
      if (batchSubmitLabel) batchSubmitLabel.textContent = total > 0 ? ('批量保存 · ' + total + ' 个') : '批量保存';
    }

    if (batchSubmitBtn) {
      batchSubmitBtn.addEventListener('click', function () {
        var newStickers = [];
        pendingFiles.forEach(function (f) {
          newStickers.push({
            id: newId(),
            src: f.src,
            text: stripExtension(f.name),
            groupId: batchPickedTag,
            createdAt: Date.now()
          });
        });
        pendingTextEntries.forEach(function (it) {
          if (it.status === 'err') return;
          newStickers.push({
            id: newId(),
            src: it.url,
            text: it.name,
            groupId: batchPickedTag,
            createdAt: Date.now()
          });
        });
        if (!newStickers.length) return;
        loadStickers().then(function (list) {
          return saveStickers(list.concat(newStickers));
        }).then(function () {
          flashToast('已批量导入 ' + newStickers.length + ' 个表情');
          batchDialog.close();
          refreshEverything();
        });
      });
    }

    /* ==========================================================================
       分组管理弹窗
    ========================================================================== */
    var tagManagerDialog = wireDialog('evTagManagerDialog', 'evTagManagerClose', function () {
      document.getElementById('evTagNewField').value = '';
      Promise.all([loadGroups(), loadStickers()]).then(function (res) {
        paintTagManagerList(res[0], res[1]);
      });
    });
    function openTagManager() { tagManagerDialog.open(); }

    var manageBtn = document.getElementById('evNavManage');
    if (manageBtn) manageBtn.addEventListener('click', openTagManager);

    var tagNewField = document.getElementById('evTagNewField');
    var tagNewBtn = document.getElementById('evTagNewBtn');
    var tagPlusInline = document.getElementById('evTagPlusInline');

    function createNewGroup(name) {
      var val = (name || '').trim().slice(0, 12);
      if (!val) return;
      loadGroups().then(function (list) {
        list.push({ id: newId(), name: val, createdAt: Date.now() });
        return saveGroups(list);
      }).then(function () {
        flashToast('已新建分组');
        if (tagNewField) tagNewField.value = '';
        Promise.all([loadGroups(), loadStickers()]).then(function (res) {
          paintTagManagerList(res[0], res[1]);
        });
        refreshEverything();
      });
    }
    if (tagNewBtn) tagNewBtn.addEventListener('click', function () { createNewGroup(tagNewField.value); });
    if (tagNewField) {
      tagNewField.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') createNewGroup(tagNewField.value);
      });
    }
    if (tagPlusInline) tagPlusInline.addEventListener('click', openTagManager);

    /* ==========================================================================
       详情编辑弹窗
    ========================================================================== */
    var editingId = null;
    var editPreviewEl = document.getElementById('evEditPreview');
    var editTextField = document.getElementById('evEditTextField');

    var editDialog = wireDialog('evEditDialog', 'evEditClose', null);

    function openEditor(id) {
      loadStickers().then(function (list) {
        var sticker = list.filter(function (s) { return s.id === id; })[0];
        if (!sticker) return;
        editingId = id;
        editPickedTag = sticker.groupId || null;
        if (editPreviewEl) {
          editPreviewEl.innerHTML = '<img src="' + escapeHtml(sticker.src) + '" alt="" />';
        }
        if (editTextField) editTextField.value = sticker.text || '';
        refreshEditPicker();
        editDialog.open();
      });
    }

    var editSaveBtn = document.getElementById('evEditSave');
    if (editSaveBtn) {
      editSaveBtn.addEventListener('click', function () {
        if (!editingId) return;
        loadStickers().then(function (list) {
          var next = list.map(function (s) {
            if (s.id === editingId) {
              s.text = editTextField ? editTextField.value.trim() : s.text;
              s.groupId = editPickedTag;
            }
            return s;
          });
          return saveStickers(next);
        }).then(function () {
          flashToast('已保存修改');
          editDialog.close();
          refreshEverything();
        });
      });
    }

    var editDeleteBtn = document.getElementById('evEditDelete');
    if (editDeleteBtn) {
      editDeleteBtn.addEventListener('click', function () {
        if (!editingId) return;
        loadStickers().then(function (list) {
          var next = list.filter(function (s) { return s.id !== editingId; });
          return saveStickers(next);
        }).then(function () {
          flashToast('已删除表情');
          editDialog.close();
          refreshEverything();
        });
      });
    }

    /* ==========================================================================
       首次挂载
    ========================================================================== */
    refreshEverything();
  });
})();
