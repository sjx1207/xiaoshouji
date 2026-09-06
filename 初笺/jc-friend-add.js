/* ==========================================================================
   角初笺 × CHAT · jc-friend-add.js
   凭「角初笺」详情页签发的 LUNA ID + 验证码，把角色写入 Chat 的好友列表。
   —— 直接读写 chat.js 使用的同一个库：luna_chat_db / kv / key='friendGroups'
      好友对象字段与 chat.js 的 buildItem() 完全对齐：
      { name, avatar, note, badge, online, charId }
========================================================================== */
(function () {
  'use strict';
  var esc = JC.esc;
  JC.bootChrome();

  document.getElementById('backBtn').addEventListener('click', function () {
    // 从 chat 端进来的就回 chat，从角初笺进来的就回详情
    if (document.referrer && /chat\.html/.test(document.referrer)) JC.go('chat.html');
    else JC.back('chat.html');
  });

  /* ============ Chat 端数据库（与 chat.js 的 LunaDB 完全一致） ============ */
  var ChatDB = (function () {
    var NAME = 'luna_chat_db', VER = 1, STORE = 'kv', p = null;
    function open() {
      if (p) return p;
      p = new Promise(function (res, rej) {
        var req = indexedDB.open(NAME, VER);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
        };
        req.onsuccess = function () { res(req.result); };
        req.onerror = function () { rej(req.error); };
      });
      return p;
    }
    return {
      get: function (key) {
        return open().then(function (db) {
          return new Promise(function (res, rej) {
            var r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
            r.onsuccess = function () { res(r.result ? r.result.value : undefined); };
            r.onerror = function () { rej(r.error); };
          });
        }).catch(function () { return undefined; });
      },
      set: function (key, value) {
        return open().then(function (db) {
          return new Promise(function (res, rej) {
            var r = db.transaction(STORE, 'readwrite').objectStore(STORE).put({ key: key, value: value });
            r.onsuccess = function () { res(true); };
            r.onerror = function () { rej(r.error); };
          });
        }).catch(function () { return false; });
      }
    };
  })();

  /* ============ 签发登记表 ============ */
  function registry() {
    try { return JSON.parse(localStorage.getItem('jc_luna_registry') || '[]'); } catch (e) { return []; }
  }
  function setRegistry(l) { localStorage.setItem('jc_luna_registry', JSON.stringify(l)); }

  /* ============ 验证码输入格 ============ */
  var cells = Array.prototype.slice.call(document.querySelectorAll('.cell'));
  cells.forEach(function (c, i) {
    c.addEventListener('input', function () {
      c.value = c.value.replace(/\D/g, '').slice(0, 1);
      c.classList.toggle('filled', !!c.value);
      if (c.value && cells[i + 1]) cells[i + 1].focus();
    });
    c.addEventListener('keydown', function (e) {
      if (e.key === 'Backspace' && !c.value && cells[i - 1]) cells[i - 1].focus();
    });
    c.addEventListener('paste', function (e) {
      var t = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
      if (!t) return;
      e.preventDefault();
      t.split('').slice(0, 6).forEach(function (ch, j) {
        if (cells[j]) { cells[j].value = ch; cells[j].classList.add('filled'); }
      });
      cells[Math.min(5, t.length - 1)].focus();
    });
  });
  function codeValue() { return cells.map(function (c) { return c.value; }).join(''); }

  /* 从 URL 预填 */
  var pre = new URLSearchParams(location.search).get('id');
  if (pre) document.getElementById('idInput').value = pre;

  document.getElementById('idInput').addEventListener('input', function (e) {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  });

  /* ============ 验证并添加 ============ */
  var msg = document.getElementById('vfMsg');
  document.getElementById('verifyBtn').addEventListener('click', function () {
    var id = document.getElementById('idInput').value.trim().toUpperCase();
    var code = codeValue();
    if (!id) { fail('请填写 LUNA ID'); return; }
    if (code.length < 6) { fail('验证码还差 ' + (6 - code.length) + ' 位'); return; }

    var rec = registry().filter(function (r) { return r.lunaId === id; })[0];
    if (!rec) { fail('查无此编号 —— 请确认已在角初笺中签发'); return; }
    if (rec.lunaCode !== code) { fail('验证码不符'); return; }

    addFriend(rec).then(function () {
      ok('已添加 · ' + rec.name);
      showCard(rec);
      rec.claimed = true;
      var l = registry().map(function (r) { return r.lunaId === id ? rec : r; });
      setRegistry(l);
      renderPending();
      JC.toast('「' + rec.name + '」已加入 Chat 好友列表');
    });
  });

  function fail(t) { msg.className = 'vf-msg err'; msg.textContent = t; }
  function ok(t) { msg.className = 'vf-msg ok'; msg.textContent = t; }

  function addFriend(rec) {
    return ChatDB.get('friendGroups').then(function (groups) {
      if (!groups || !Array.isArray(groups) || !groups.length) {
        groups = [
          { id: 'starred', cn: '星标挚友', en: 'STARRED', collapsed: false, friends: [] },
          { id: 'default', cn: '我的好友', en: 'ALL FRIENDS', collapsed: false, friends: [] }
        ];
      }
      var target = groups.filter(function (g) { return g.id === 'default'; })[0] || groups[groups.length - 1];
      var exists = groups.some(function (g) {
        return g.friends.some(function (f) { return f.name === rec.name || f.lunaId === rec.lunaId; });
      });
      if (!exists) {
        target.friends.push({
          name: rec.name,
          avatar: rec.avatar || '',
          note: rec.tagline || rec.identity || '',
          badge: rec.mbti || '',
          online: true,
          charId: null,
          lunaId: rec.lunaId,
          from: '角初笺'
        });
      }
      return ChatDB.set('friendGroups', groups);
    }).then(function () {
      // 通知 chat 端刷新
      localStorage.setItem('luna_characters_updated', Date.now());
      localStorage.setItem('jc_friend_added', Date.now());
    });
  }

  function showCard(rec) {
    var card = document.getElementById('fcard');
    card.classList.remove('jc-hide');
    var bg = document.getElementById('fcBg');
    bg.querySelectorAll('img').forEach(function (n) { n.remove(); });
    if (rec.cardBg) {
      var im = document.createElement('img'); im.src = rec.cardBg;
      bg.insertBefore(im, bg.firstChild);
    }
    var av = document.getElementById('fcAv');
    av.querySelectorAll('img').forEach(function (n) { n.remove(); });
    if (rec.avatar) {
      var a = document.createElement('img'); a.src = rec.avatar;
      av.insertBefore(a, av.firstChild);
      document.getElementById('fcAvGlyph').style.display = 'none';
    } else {
      document.getElementById('fcAvGlyph').style.display = '';
      document.getElementById('fcAvGlyph').textContent = (rec.name || '笺').charAt(0);
    }
    document.getElementById('fcName').textContent = rec.name || '';
    document.getElementById('fcEn').textContent = (rec.enName || '').toUpperCase();
    document.getElementById('fcMeta').innerHTML = [rec.gender, rec.age ? rec.age + ' 岁' : '', rec.mbti, rec.identity, rec.lang]
      .filter(Boolean).map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ============ 待认领列表 ============ */
  function renderPending() {
    var list = registry();
    document.getElementById('pendCount').textContent = list.length;
    document.getElementById('pendEmpty').classList.toggle('on', !list.length);
    document.getElementById('pendList').innerHTML = list.map(function (r, i) {
      return '<div class="pend' + (r.claimed ? ' done' : '') + '" data-id="' + esc(r.lunaId) + '" style="animation-delay:' + (i * .05) + 's">' +
        '<div class="pend-av">' + (r.avatar ? '<img src="' + esc(r.avatar) + '">' : esc((r.name || '?').charAt(0))) + '</div>' +
        '<div class="pend-col">' +
          '<div class="pend-n">' + esc(r.name) + '</div>' +
          '<div class="pend-id">' + esc(r.lunaId) + '</div>' +
        '</div>' +
        '<button class="pend-use" data-fill="' + esc(r.lunaId) + '">' + (r.claimed ? '已添加' : '填 入') + '</button>' +
      '</div>';
    }).join('');

    document.querySelectorAll('[data-fill]').forEach(function (b) {
      b.addEventListener('click', function () {
        var r = registry().filter(function (x) { return x.lunaId === b.dataset.fill; })[0];
        if (!r) return;
        document.getElementById('idInput').value = r.lunaId;
        r.lunaCode.split('').forEach(function (ch, j) {
          if (cells[j]) { cells[j].value = ch; cells[j].classList.add('filled'); }
        });
        msg.className = 'vf-msg'; msg.textContent = '已填入，点上方按钮完成验证';
        document.querySelector('.verify').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }
  renderPending();
})();