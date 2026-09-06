/* ==========================================================================
   角初笺 · jc-vault.js — 生成库
   逻辑约定：
     · 只要模型吐出过角色，就无条件写进 vault（花过额度的不能丢）
     · state: new 未处理 / liked 已收进存档 / passed 左滑划走的 / trashed 已清除
     · trashed 不再展示，但记录仍在库里，方便日后追溯用量
========================================================================== */
(function () {
  'use strict';
  var esc = JC.esc, DB = JC.DB;
  JC.bootChrome();

  document.getElementById('backBtn').addEventListener('click', function () { JC.back('juechu.html'); });

  var all = [], filter = 'all', dense = false;
  var grid = document.getElementById('fdGrid');

  function load() {
    JC.Vault.all().then(function (l) {
      all = l;
      count();
      render();
    });
  }

  function count() {
    var n = { all: all.length, new: 0, liked: 0, passed: 0 };
    all.forEach(function (x) { if (n[x.state] != null) n[x.state]++; });
    document.getElementById('cAll').textContent = n.all;
    document.getElementById('cNew').textContent = n.new;
    document.getElementById('cLiked').textContent = n.liked;
    document.getElementById('cPassed').textContent = n.passed;
  }

  var STATE_CN = { new: '未处理', liked: '已收藏', passed: '划走', trashed: '已清除' };

  function render() {
    var list = filter === 'all' ? all : all.filter(function (x) { return x.state === filter; });
    document.getElementById('fdEmpty').classList.toggle('on', !list.length);
    grid.classList.toggle('dense', dense);
    grid.innerHTML = list.map(function (c, i) {
      var A = JC.CardArt.spec(c);
      var thumb = c.cardBg
        ? '<span class="fd-th" style="background-image:url(' + esc(c.cardBg) + ')"></span>'
        : '<span class="fd-th drawn" style="background:linear-gradient(155deg,' + A.palette[1] + ',' + A.palette[0] + ')">' +
          '<span class="fd-th-glyph" style="color:' + A.accent + '">' + esc(A.glyph) + '</span></span>';
      return '<button class="fd-card s-' + esc(c.state) + '" data-id="' + c.id + '" style="animation-delay:' + Math.min(i * .035, .5) + 's">' +
        thumb +
        '<span class="fd-veil"></span>' +
        '<span class="fd-state">' + esc(STATE_CN[c.state] || '') + '</span>' +
        '<span class="fd-col">' +
          '<span class="fd-n">' + esc(c.name || '—') + '</span>' +
          '<span class="fd-m">' + esc([c.gender, c.age ? c.age + '岁' : '', c.mbti].filter(Boolean).join(' · ')) + '</span>' +
          '<span class="fd-t">' + esc(c.tagline || '') + '</span>' +
        '</span>' +
        '<span class="fd-ts">' + esc(JC.timeAgo(c.vaultTs || c.ts || Date.now())) + '</span>' +
      '</button>';
    }).join('');

    grid.querySelectorAll('.fd-card').forEach(function (b) {
      b.addEventListener('click', function () { open(Number(b.dataset.id)); });
    });
  }

  document.querySelectorAll('.fd-f').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.fd-f').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      filter = b.dataset.f;
      render();
    });
  });

  document.getElementById('viewToggle').addEventListener('click', function () {
    dense = !dense; render();
    JC.toast(dense ? '密排' : '宽排');
  });

  /* ---------------- 预览 ---------------- */
  var cur = null;
  var view = document.getElementById('fdView');
  var stage = document.getElementById('fdStage');

  function open(id) {
    cur = all.filter(function (x) { return x.id === id; })[0];
    if (!cur) return;
    stage.innerHTML = '';
    JC.CardArt.mount(stage, cur, { fast: true });
    view.classList.add('on');
  }
  function close() { view.classList.remove('on'); stage.innerHTML = ''; cur = null; }
  document.getElementById('fdViewMask').addEventListener('click', close);

  document.querySelectorAll('.fd-act').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!cur) return;
      var act = b.dataset.act;
      if (act === 'archive') {
        var rec = Object.assign({}, cur);
        delete rec.id; delete rec.state; delete rec.vaultTs;
        DB.put('cards', rec).then(function () {
          return JC.Vault.mark(cur.id, 'liked');
        }).then(function () {
          JC.toast('已收入存档');
          close(); load();
        });
      } else if (act === 'detail') {
        DB.kvSet('viewing', cur).then(function () { JC.go('jc-detail.html'); });
      } else if (act === 'drop') {
        JC.Vault.mark(cur.id, 'trashed').then(function () {
          JC.toast('已从库中清除');
          close(); load();
        });
      }
    });
  });

  load();
})();
