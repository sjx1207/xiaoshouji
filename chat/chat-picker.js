/* ==========================================================================
   chat-picker.js
   "单聊" 创建流程 · 第一步：从角色书（characters.js 所用的 LunaCharDB）
   中选择一个角色，用于创建单聊会话。

   数据来源：与 characters.js 完全同一份 IndexedDB —— LunaCharDB / chars
   store，字段包括 id / name / role / avatar / desc / traits / prompt 等，
   因此角色书里新增/编辑的角色，无需任何额外同步代码，本页读到的
   永远是最新数据。

   选中角色并点击"创建单聊"后，交由 chat-conversation.js 的
   window.LunaConversations.createSingleChat(char) 完成"同步为好友"
   （归入好友页"全部好友"分组），不创建会话、不打开聊天室——
   聊天室页面待后续单独设计后再接入。
========================================================================== */
(function () {
  'use strict';

  var CHAR_DB_NAME = 'LunaCharDB';
  var CHAR_STORE = 'chars';

  /* ---- 只读打开角色书 DB：若角色书从未被创建过（用户还没建过任何
     角色），indexedDB.open 仍会成功但没有 chars store，此时安全返回
     空数组，不抛错、不阻塞单聊入口 ---- */
  function openCharDbReadonly() {
    return new Promise(function (resolve) {
      var req = indexedDB.open(CHAR_DB_NAME);
      req.onsuccess = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(CHAR_STORE)) {
          db.close();
          resolve(null);
          return;
        }
        resolve(db);
      };
      req.onerror = function () { resolve(null); };
      // 角色书 DB 尚不存在时，onupgradeneeded 会创建一个空库；
      // 我们不在这里建 store（那是 characters.js 的职责），只读取。
      req.onupgradeneeded = function () {};
    });
  }

  function getAllCharacters() {
    return openCharDbReadonly().then(function (db) {
      if (!db) return [];
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(CHAR_STORE, 'readonly');
          var store = tx.objectStore(CHAR_STORE);
          var req = store.getAll();
          req.onsuccess = function () { resolve(req.result || []); };
          req.onerror = function () { resolve([]); };
        } catch (e) { resolve([]); }
      });
    });
  }

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ==========================================================================
     角色选择子页：注入 DOM（若尚未存在），绑定交互
  ========================================================================== */
  function ensureSubpageMarkup() {
    if (document.getElementById('charPickerPage')) return;

    var root = document.querySelector('.phone-frame');
    if (!root) return;

    var el = document.createElement('div');
    el.className = 'subpage';
    el.id = 'charPickerPage';
    el.innerHTML =
      '<div class="subpage-top">' +
        '<div class="subpage-topbar">' +
          '<button class="subpage-back" id="charPickerBack" aria-label="返回">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M14.5 5L7.5 12L14.5 19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '</button>' +
          '<div class="subpage-title-wrap">' +
            '<div class="subpage-title-seal">' +
              '<span class="sts-num">05</span>' +
              '<span class="sts-col">' +
                '<span class="sts-cn">选择角色</span>' +
                '<span class="sts-en">PICK&nbsp;A&nbsp;CHARACTER</span>' +
              '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="subpage-body">' +
        '<div class="cp-hint">从<b>角色书</b>中选择一位角色，即刻创建单聊会话，角色资料将自动同步。</div>' +
        '<div class="cp-search">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6.6" stroke="currentColor" stroke-width="1.6"/><path d="M19.5 19.5L15.9 15.9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' +
          '<input type="text" id="charPickerSearch" placeholder="搜索角色姓名或身份" autocomplete="off" />' +
        '</div>' +
        '<div class="cp-section-label">' +
          '<span class="cp-section-cn">角色档案</span>' +
          '<span class="cp-section-count" id="charPickerCount">0 位</span>' +
        '</div>' +
        '<div class="cp-list" id="charPickerList"></div>' +
        '<div class="cp-empty" id="charPickerEmpty" style="display:none">' +
          '<div class="cp-empty-ring"><span class="cp-empty-dot"></span></div>' +
          '<div class="cp-empty-cn">角色书暂无角色</div>' +
          '<div class="cp-empty-desc">请先前往角色档案页创建一个角色，再回到这里发起单聊</div>' +
        '</div>' +
      '</div>' +
      '<div class="cp-confirm-bar" id="charPickerConfirmBar">' +
        '<button class="cp-confirm-btn" id="charPickerConfirmBtn">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 12.5L10 17.5L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '<span>创建单聊</span>' +
        '</button>' +
      '</div>';

    root.appendChild(el);
  }

  var pickedChar = null;

  function buildCard(c) {
    var card = document.createElement('button');
    card.type = 'button';
    card.className = 'cp-card';
    card.dataset.id = c.id;

    var letter = (c.name || '?').charAt(0).toUpperCase();
    var avatarInner = c.avatar
      ? '<img src="' + c.avatar + '" alt="" />'
      : '<span class="cp-avatar-letter">' + escHtml(letter) + '</span>';

    var traits = Array.isArray(c.traits) ? c.traits.slice(0, 3) : [];
    var traitsHtml = traits.length
      ? '<div class="cp-traits">' + traits.map(function (t) { return '<span class="cp-trait">' + escHtml(t) + '</span>'; }).join('') + '</div>'
      : '';

    card.innerHTML =
      '<div class="cp-avatar">' + avatarInner + '</div>' +
      '<div class="cp-body">' +
        '<div class="cp-name-row">' +
          '<span class="cp-name">' + escHtml(c.name || '未命名角色') + '</span>' +
          (c.role ? '<span class="cp-role-tag">' + escHtml(c.role) + '</span>' : '') +
        '</div>' +
        (c.desc ? '<div class="cp-desc">' + escHtml(c.desc) + '</div>' : '') +
        traitsHtml +
      '</div>' +
      '<span class="cp-arrow">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12.5L10 17.5L19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '</span>';

    card.addEventListener('click', function () {
      pickedChar = c;
      Array.prototype.slice.call(document.querySelectorAll('.cp-card')).forEach(function (n) {
        n.classList.toggle('is-picked', n === card);
      });
      var bar = document.getElementById('charPickerConfirmBar');
      if (bar) bar.classList.add('is-ready');
    });

    return card;
  }

  var allChars = [];

  function renderList(filterText) {
    var listEl = document.getElementById('charPickerList');
    var emptyEl = document.getElementById('charPickerEmpty');
    var countEl = document.getElementById('charPickerCount');
    if (!listEl) return;

    var q = (filterText || '').trim().toLowerCase();
    var filtered = !q ? allChars : allChars.filter(function (c) {
      var hay = ((c.name || '') + ' ' + (c.role || '')).toLowerCase();
      return hay.indexOf(q) !== -1;
    });

    listEl.innerHTML = '';
    filtered.forEach(function (c) { listEl.appendChild(buildCard(c)); });

    if (countEl) countEl.textContent = filtered.length + ' 位';
    if (emptyEl) emptyEl.style.display = allChars.length === 0 ? 'flex' : 'none';
    listEl.style.display = allChars.length === 0 ? 'none' : 'flex';
  }

  function refreshCharacters() {
    return getAllCharacters().then(function (chars) {
      allChars = chars || [];
      var input = document.getElementById('charPickerSearch');
      renderList(input ? input.value : '');
    });
  }

  function resetPickerState() {
    pickedChar = null;
    var bar = document.getElementById('charPickerConfirmBar');
    if (bar) bar.classList.remove('is-ready');
    var input = document.getElementById('charPickerSearch');
    if (input) input.value = '';
  }

  function openPicker() {
    ensureSubpageMarkup();
    bindOnce();
    resetPickerState();
    refreshCharacters();
    var page = document.getElementById('charPickerPage');
    if (page) page.classList.add('is-open');
  }

  function closePicker() {
    var page = document.getElementById('charPickerPage');
    if (page) page.classList.remove('is-open');
  }

  var bound = false;
  function bindOnce() {
    if (bound) return;
    bound = true;

    var backBtn = document.getElementById('charPickerBack');
    if (backBtn) backBtn.addEventListener('click', closePicker);

    var searchInput = document.getElementById('charPickerSearch');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        renderList(searchInput.value);
      });
    }

    var confirmBtn = document.getElementById('charPickerConfirmBtn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', function () {
        if (!pickedChar) return;
        confirmBtn.style.transform = 'scale(0.94)';
        setTimeout(function () { confirmBtn.style.transform = ''; }, 140);

        if (window.LunaConversations && window.LunaConversations.createSingleChat) {
          window.LunaConversations.createSingleChat(pickedChar).then(function () {
            closePicker();
          });
        }
      });
    }
  }

  // 暴露给"加好友"弹窗的"单聊"选项调用
  window.LunaCharPicker = {
    open: openPicker,
    close: closePicker,
    refresh: refreshCharacters
  };
})();