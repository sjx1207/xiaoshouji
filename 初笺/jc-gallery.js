/* ==========================================================================
   角初笺 · jc-gallery.js — 背景 / 头像 素材库（批量上传，供角色卡随机取用）
========================================================================== */
(function () {
  'use strict';
  JC.bootChrome();
  document.getElementById('backBtn').addEventListener('click', function () { JC.back('juechu.html'); });

  var type = 'bg';
  var grid = document.getElementById('grid');
  var empty = document.getElementById('galEmpty');
  var fileMulti = document.getElementById('fileMulti');
  var editing = false;

  document.querySelectorAll('.gal-tab').forEach(function (b) {
    b.addEventListener('click', function () {
      type = b.dataset.t;
      document.querySelectorAll('.gal-tab').forEach(function (x) { x.classList.toggle('on', x === b); });
      document.getElementById('upTitle').textContent = type === 'bg' ? '投入背景' : '投入头像';
      grid.className = 'grid ' + (type === 'bg' ? 'bg' : 'av') + (editing ? ' editing' : '');
      render();
    });
  });

  document.getElementById('editToggle').addEventListener('click', function () {
    editing = !editing;
    grid.classList.toggle('editing', editing);
    JC.toast(editing ? '管理模式：点右上角小叉移除' : '已退出管理模式');
  });

  document.getElementById('upSlab').addEventListener('click', function () {
    fileMulti.value = '';
    fileMulti.click();
  });

  fileMulti.addEventListener('change', function () {
    var files = Array.prototype.slice.call(fileMulti.files || []);
    if (!files.length) return;
    JC.toast('正在写入 ' + files.length + ' 张…');
    var maxW = type === 'bg' ? 1200 : 640;
    var chain = Promise.resolve();
    files.forEach(function (f) {
      chain = chain.then(function () {
        return JC.fileToDataURL(f, maxW).then(function (d) {
          return JC.Gallery.add(type, d, f.name);
        });
      });
    });
    chain.then(function () {
      render();
      JC.toast('已投入 ' + files.length + ' 张' + (type === 'bg' ? '背景' : '头像'));
    }).catch(function (e) { JC.toast('写入失败：' + e.message); });
  });

  function counts() {
    JC.Gallery.all().then(function (l) {
      document.getElementById('nBg').textContent = l.filter(function (a) { return a.type === 'bg'; }).length;
      document.getElementById('nAv').textContent = l.filter(function (a) { return a.type === 'avatar'; }).length;
    });
  }

  function render() {
    JC.Gallery.byType(type).then(function (list) {
      list.sort(function (a, b) { return b.ts - a.ts; });
      empty.style.display = list.length ? 'none' : '';
      grid.innerHTML = list.map(function (a, i) {
        return '<div class="tile" style="animation-delay:' + Math.min(i * .022, .5) + 's">' +
          '<img src="' + a.data + '" alt="">' +
          '<button class="tile-del" data-id="' + a.id + '">×</button>' +
        '</div>';
      }).join('');
      grid.querySelectorAll('.tile-del').forEach(function (b) {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          JC.Gallery.del(Number(b.dataset.id)).then(function () { render(); counts(); });
        });
      });
      counts();
    });
  }

  render();
})();
